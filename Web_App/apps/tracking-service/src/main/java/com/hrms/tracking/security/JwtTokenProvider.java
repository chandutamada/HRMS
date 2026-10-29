package com.hrms.tracking.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;

@Component
public class JwtTokenProvider {

    private final SecretKey key;
    private final long expirationMs;

    public JwtTokenProvider(
            @Value("${security.jwt.secret:super_secret_hrms_jwt_access_key_2026_superbee_gtids_gtib!}") String secret,
            @Value("${security.jwt.expiration:3600000}") long expirationMs) {
        // Ensure secret key is at least 256 bits (32 bytes)
        byte[] secretBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (secretBytes.length < 32) {
            byte[] padded = new byte[32];
            System.arraycopy(secretBytes, 0, padded, 0, secretBytes.length);
            this.key = Keys.hmacShaKeyFor(padded);
        } else {
            this.key = Keys.hmacShaKeyFor(secretBytes);
        }
        this.expirationMs = expirationMs;
    }

    public boolean validateToken(String token) {
        try {
            Jwts.parser()
                    .verifyWith(this.key)
                    .build()
                    .parseSignedClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public Claims getClaims(String token) {
        return Jwts.parser()
                .verifyWith(this.key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    @SuppressWarnings("unchecked")
    public AuthenticatedEmployee extractEmployee(String token) {
        Claims claims = getClaims(token);

        String userId = claims.getSubject();
        String email = claims.get("email", String.class);
        String employeeCode = claims.get("employeeCode", String.class);
        String employeeId = claims.get("employeeId", String.class);
        String companyId = claims.get("companyId", String.class);
        List<String> roles = claims.get("roles", List.class);

        return AuthenticatedEmployee.builder()
                .userId(userId)
                .email(email != null ? email : userId)
                .employeeCode(employeeCode)
                .employeeId(employeeId)
                .companyId(companyId)
                .roles(roles != null ? roles : List.of("EMPLOYEE"))
                .build();
    }

    public String generateToken(String userId, String email, String companyId, List<String> roles) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + expirationMs);

        return Jwts.builder()
                .subject(userId)
                .claim("email", email)
                .claim("companyId", companyId)
                .claim("roles", roles)
                .issuedAt(now)
                .expiration(expiryDate)
                .signWith(this.key)
                .compact();
    }
}
