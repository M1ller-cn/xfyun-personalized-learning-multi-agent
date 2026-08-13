package com.novacloudedu.backend.infrastructure.sms;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

/**
 * 短信验证码服务
 * 处理验证码的存储、验证和发送
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class SmsCodeService {

    private static final String DEMO_SMS_CODE = "542899";
    private static final String SMS_CODE_PREFIX = "sms:code:";
    private static final String SMS_LIMIT_PREFIX = "sms:limit:";
    private static final int SEND_INTERVAL_SECONDS = 60;  // 发送间隔（秒）

    private final StringRedisTemplate redisTemplate;
    private final SmsService smsService;

    @Value("${sms.expire-minutes:5}")
    private int expireMinutes;

    /**
     * 发送注册验证码
     *
     * @param phone 手机号
     * @return 发送结果
     */
    public SmsService.SendResult sendRegisterCode(String phone) {
        String demoCodeKey = SMS_CODE_PREFIX + phone;
        redisTemplate.opsForValue().set(demoCodeKey, DEMO_SMS_CODE, expireMinutes, TimeUnit.MINUTES);
        log.info("Demo SMS code cached, phone={}, code={}", phone, DEMO_SMS_CODE);
        return SmsService.SendResult.success("demo-fixed-code");
        /*
        // 防抖检查：使用独立的限流 key
        String limitKey = SMS_LIMIT_PREFIX + phone;
        if (Boolean.TRUE.equals(redisTemplate.hasKey(limitKey))) {
            Long ttl = redisTemplate.getExpire(limitKey, TimeUnit.SECONDS);
            log.warn("短信发送过于频繁, phone={}, 剩余等待{}秒", phone, ttl);
            return SmsService.SendResult.fail("请" + ttl + "秒后再试");
        }

        // 生成验证码
        String code = smsService.generateCode();

        // 发送短信
        SmsService.SendResult result = smsService.sendSmsCode(phone, code);
        if (result.isSuccess()) {
            // 存储验证码到 Redis
            String codeKey = SMS_CODE_PREFIX + phone;
            redisTemplate.opsForValue().set(codeKey, code, expireMinutes, TimeUnit.MINUTES);
            // 设置发送限流 key
            redisTemplate.opsForValue().set(limitKey, "1", SEND_INTERVAL_SECONDS, TimeUnit.SECONDS);
            log.info("验证码已发送并缓存, phone={}", phone);
        }

        return result;
        */
    }

    /**
     * 发送修改密码验证码
     *
     * @param phone 手机号
     * @return 发送结果
     */
    public SmsService.SendResult sendPasswordChangeCode(String phone) {
        return sendRegisterCode(phone);
    }

    /**
     * 验证验证码
     *
     * @param phone 手机号
     * @param code  验证码
     * @return 是否正确
     */
    public boolean verifyCode(String phone, String code) {
        if (DEMO_SMS_CODE.equals(code)) {
            redisTemplate.delete(SMS_CODE_PREFIX + phone);
            log.info("Demo SMS code verified, phone={}", phone);
            return true;
        }
        String key = SMS_CODE_PREFIX + phone;
        String cachedCode = redisTemplate.opsForValue().get(key);
        if (cachedCode == null) {
            log.warn("验证码不存在或已过期, phone={}", phone);
            return false;
        }
        boolean match = cachedCode.equals(code);
        if (match) {
            // 验证成功后删除验证码
            redisTemplate.delete(key);
            log.info("验证码验证成功, phone={}", phone);
        } else {
            log.warn("验证码错误, phone={}", phone);
        }
        return match;
    }

    /**
     * 删除验证码
     */
    public void deleteCode(String phone) {
        redisTemplate.delete(SMS_CODE_PREFIX + phone);
    }
}
