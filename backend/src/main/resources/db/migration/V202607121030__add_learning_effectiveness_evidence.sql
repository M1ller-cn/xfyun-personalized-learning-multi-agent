CREATE TABLE IF NOT EXISTS learning_effectiveness_assessment (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    course_key VARCHAR(32) NOT NULL,
    topic_id VARCHAR(64) NOT NULL,
    assessment_type VARCHAR(32) NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    score INTEGER NOT NULL,
    passed SMALLINT NOT NULL DEFAULT 0,
    counts_as_mastery_evidence SMALLINT NOT NULL DEFAULT 1,
    feedback TEXT NOT NULL,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_learning_effectiveness_user_topic_time
    ON learning_effectiveness_assessment (user_id, course_key, topic_id, create_time DESC);

CREATE INDEX IF NOT EXISTS idx_learning_effectiveness_user_type
    ON learning_effectiveness_assessment (user_id, assessment_type, create_time DESC);
