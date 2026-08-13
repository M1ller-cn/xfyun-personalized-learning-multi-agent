CREATE TABLE IF NOT EXISTS personalized_learning_goal (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    course_key VARCHAR(32) NOT NULL,
    title VARCHAR(512) NOT NULL,
    priority VARCHAR(32) NOT NULL DEFAULT 'CURRENT',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    confirmed SMALLINT NOT NULL DEFAULT 0,
    source_evidence TEXT NULL,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_personalized_learning_goal UNIQUE (user_id, course_key, title)
);

CREATE INDEX IF NOT EXISTS idx_personalized_goal_user_status
    ON personalized_learning_goal (user_id, status, priority);

CREATE TABLE IF NOT EXISTS personalized_learning_profile_fact (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    fact_key VARCHAR(64) NOT NULL,
    fact_value TEXT NOT NULL,
    source_evidence TEXT NOT NULL,
    confirmed SMALLINT NOT NULL DEFAULT 0,
    update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_personalized_learning_profile_fact UNIQUE (user_id, fact_key)
);

CREATE TABLE IF NOT EXISTS personalized_learning_adjustment (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    adjustment_type VARCHAR(64) NOT NULL,
    message TEXT NOT NULL,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_personalized_adjustment_user_time
    ON personalized_learning_adjustment (user_id, create_time DESC);

CREATE TABLE IF NOT EXISTS personalized_learning_pending_course_intent (
    user_id BIGINT PRIMARY KEY,
    target_course_key VARCHAR(32) NOT NULL,
    source_message TEXT NOT NULL,
    create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
