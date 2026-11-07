-- GEN-4: formas de responder e estímulos do ENADE nas questões geradas
-- (docs/ENADE-ITEM-FORMATS.md). Versões antigas continuam com 'ITENS'.
ALTER TABLE generated_question DROP CONSTRAINT generated_question_item_format_check;
ALTER TABLE generated_question ADD CONSTRAINT generated_question_item_format_check CHECK (item_format IN (
  'SIMPLES', 'ITENS', 'ITENS3', 'ITENS4', 'ASSERCAO', 'ORDEM', 'CALCULO', 'CODIGO_OPCOES', 'ASSOCIACAO'));
ALTER TABLE generated_question
  ADD COLUMN stimulus text[] NOT NULL DEFAULT '{}' CHECK (stimulus <@ ARRAY[
    'TEXTO_BASE', 'CENARIO', 'CODIGO', 'TABELA', 'FIGURA', 'GRAFICO', 'DOIS_TEXTOS', 'CHARGE']::text[]),
  -- Figura do enunciado: SVG feito a partir dos dados (/figures/) ou ilustração do catálogo (/illustrations/).
  ADD COLUMN figure_src text CHECK (figure_src ~ '^/(figures|illustrations)/[A-Za-z0-9-]+\.(svg|webp)$'),
  ADD COLUMN figure_alt text CHECK (char_length(btrim(figure_alt)) BETWEEN 20 AND 600),
  ADD CONSTRAINT generated_question_figure_pair CHECK ((figure_src IS NULL) = (figure_alt IS NULL));
