UPDATE "user"
SET user_password = '$2a$10$5pS2kjFmnzc/ZRvJZLQQoeL3l.K3RX2lWNOGZ7MbnQXaAM9rEvSD2',
    update_time = NOW()
WHERE user_account = 'admin'
  AND user_role = 'admin'
  AND is_delete = 0;
