ALTER TABLE course ADD COLUMN IF NOT EXISTS join_code VARCHAR(32);

CREATE UNIQUE INDEX IF NOT EXISTS idx_course_join_code ON course(join_code) WHERE is_delete = 0 AND join_code IS NOT NULL;

UPDATE course
SET join_code = 'C' || lpad(id::text, 5, '0')
WHERE join_code IS NULL OR join_code = '';
