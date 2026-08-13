CREATE TABLE IF NOT EXISTS personalized_learning_path_preference (
    user_id BIGINT NOT NULL,
    course_key VARCHAR(32) NOT NULL,
    learning_mode VARCHAR(32) NOT NULL DEFAULT 'RECOMMENDED',
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, course_key)
);

CREATE TABLE IF NOT EXISTS personalized_learning_path_revision (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    course_key VARCHAR(32) NOT NULL,
    learning_mode VARCHAR(32) NOT NULL,
    reason TEXT NOT NULL,
    snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_learning_path_revision_user_course_time
    ON personalized_learning_path_revision (user_id, course_key, create_time DESC);
