-- Aulas de preparação e presença (AULA-1, D13). A lista da turma existe sem
-- conta: o aluno se liga a ela pelo prontuário quando cria a conta (a ligação
-- é calculada pela igualdade de prontuário, sem cópia que possa divergir).

CREATE TABLE study_class (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  edition_year integer NOT NULL CHECK (edition_year BETWEEN 2004 AND 2100),
  created_by uuid NOT NULL REFERENCES account(identity_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE class_member (
  id uuid PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES study_class(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  enrollment text NOT NULL CHECK (enrollment ~ '^[A-Z]{2}[0-9]{6,8}X?$'),
  email text CHECK (email IS NULL OR (email = lower(btrim(email)) AND char_length(email) BETWEEN 3 AND 254)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, enrollment)
);

CREATE TABLE lesson (
  id uuid PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES study_class(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
  room text NOT NULL CHECK (char_length(btrim(room)) BETWEEN 1 AND 60),
  subject text NOT NULL CHECK (char_length(btrim(subject)) BETWEEN 2 AND 80),
  topic text CHECK (topic IS NULL OR char_length(btrim(topic)) BETWEEN 1 AND 200),
  teacher_id uuid NOT NULL REFERENCES account(identity_id),
  created_by uuid NOT NULL REFERENCES account(identity_id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lesson_class_start_idx ON lesson(class_id, starts_at);

CREATE TABLE attendance (
  lesson_id uuid NOT NULL REFERENCES lesson(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES class_member(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
  note text CHECK (note IS NULL OR char_length(btrim(note)) BETWEEN 1 AND 200),
  recorded_by uuid NOT NULL REFERENCES account(identity_id),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lesson_id, member_id)
);

-- A presença só vale para quem é da turma da aula.
CREATE FUNCTION attendance_same_class() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM lesson l JOIN class_member m ON m.class_id = l.class_id
                 WHERE l.id = NEW.lesson_id AND m.id = NEW.member_id) THEN
    RAISE EXCEPTION 'Attendance member must belong to the lesson class' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER attendance_same_class BEFORE INSERT OR UPDATE ON attendance
  FOR EACH ROW EXECUTE FUNCTION attendance_same_class();
