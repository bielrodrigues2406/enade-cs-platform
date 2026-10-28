-- Imagem da questão (CT-1, ADR-010). O recorte do PDF original é a
-- apresentação principal de questões oficiais transcritas; o texto fica como
-- apoio para busca e leitores de tela. Bytes ficam no armazenamento de
-- arquivos, endereçados pelo SHA-256; o banco guarda metadados e a origem.
CREATE TABLE question_asset (
  sha256 text PRIMARY KEY CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  media_type text NOT NULL CHECK (media_type = 'image/webp'),
  byte_size integer NOT NULL CHECK (byte_size BETWEEN 1 AND 5242880),
  width integer NOT NULL CHECK (width BETWEEN 1 AND 8000),
  height integer NOT NULL CHECK (height BETWEEN 1 AND 16000),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE question_version
  ADD COLUMN presentation text NOT NULL DEFAULT 'TEXT'
    CHECK (presentation IN ('TEXT', 'IMAGE'));

-- Recortes de uma versão na ordem de leitura. A região (página e caixa em
-- pontos do PDF, origem no canto superior esquerdo) aponta para a prova
-- vinculada à versão, permitindo conferir e refazer o recorte.
CREATE TABLE question_version_image (
  version_id text NOT NULL REFERENCES question_version(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position BETWEEN 1 AND 20),
  asset_sha256 text NOT NULL REFERENCES question_asset(sha256),
  source_page integer NOT NULL CHECK (source_page BETWEEN 1 AND 1000),
  box numeric(8, 2)[] NOT NULL CHECK (
    cardinality(box) = 4 AND box[1] >= 0 AND box[2] >= 0 AND box[3] > box[1] AND box[4] > box[2]
  ),
  dpi integer NOT NULL CHECK (dpi BETWEEN 72 AND 600),
  PRIMARY KEY (version_id, position)
);
CREATE INDEX question_version_image_asset_idx ON question_version_image(asset_sha256);

-- Publicada, a versão não muda: nem as imagens nem a forma de apresentação.
CREATE FUNCTION protect_published_images() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_id text; new_id text;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_id = OLD.version_id; END IF;
  IF TG_OP <> 'DELETE' THEN new_id = NEW.version_id; END IF;
  IF EXISTS(SELECT 1 FROM question_version WHERE id IN (old_id, new_id) AND editorial_status = 'PUBLISHED') THEN
    -- Remoção administrativa da questão lógica inteira pode cascatear.
    IF TG_OP = 'DELETE' AND NOT EXISTS(
      SELECT 1 FROM question_version v JOIN editorial_question q ON q.id = v.question_id WHERE v.id = old_id
    ) THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Published question images are immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER question_version_image_immutable BEFORE INSERT OR UPDATE OR DELETE ON question_version_image
  FOR EACH ROW EXECUTE FUNCTION protect_published_images();

-- Versão de imagem só é publicada com ao menos um recorte, e só para conteúdo
-- oficial: é a forma de mostrar a prova como foi impressa.
CREATE FUNCTION validate_image_presentation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.presentation = 'IMAGE' AND NEW.origin <> 'OFFICIAL' THEN
    RAISE EXCEPTION 'Image presentation is reserved for official questions' USING ERRCODE = '23514';
  END IF;
  IF NEW.editorial_status = 'PUBLISHED' AND NEW.presentation = 'IMAGE'
    AND NOT EXISTS(SELECT 1 FROM question_version_image WHERE version_id = NEW.id) THEN
    RAISE EXCEPTION 'Image questions need at least one crop before publication' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER question_version_image_presentation BEFORE INSERT OR UPDATE ON question_version
  FOR EACH ROW EXECUTE FUNCTION validate_image_presentation();
