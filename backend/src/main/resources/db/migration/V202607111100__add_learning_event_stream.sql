CREATE TABLE IF NOT EXISTS learning_event (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    course_id BIGINT NULL,
    section_id BIGINT NULL,
    class_id BIGINT NULL,
    knowledge_point VARCHAR(256) NULL,
    task_id VARCHAR(128) NULL,
    subject VARCHAR(64) NOT NULL DEFAULT 'COMPUTER_SCIENCE',
    duration_sec INTEGER NOT NULL DEFAULT 0,
    score INTEGER NULL,
    max_score INTEGER NULL,
    error_category VARCHAR(128) NULL,
    source VARCHAR(64) NOT NULL DEFAULT 'STUDENT',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_learning_event_user_time
    ON learning_event (user_id, create_time DESC);
CREATE INDEX IF NOT EXISTS idx_learning_event_course_time
    ON learning_event (course_id, create_time DESC);
CREATE INDEX IF NOT EXISTS idx_learning_event_knowledge
    ON learning_event (user_id, knowledge_point, create_time DESC);

ALTER TABLE student_knowledge_profile
    ADD COLUMN IF NOT EXISTS evidence_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_evidence_at TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS forgetting_risk DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE student_knowledge_profile
SET evidence_count = GREATEST(total_attempts, evidence_count),
    last_evidence_at = COALESCE(last_evidence_at, last_updated)
WHERE evidence_count = 0 OR last_evidence_at IS NULL;
