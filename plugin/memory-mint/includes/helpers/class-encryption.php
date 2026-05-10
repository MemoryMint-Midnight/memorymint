<?php
namespace MemoryMint\Helpers;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Symmetric encryption helpers for server-side secrets (mnemonics, signing keys).
 *
 * Format v2 (current):
 *   "v2:" . base64( salt(16) . iv(12) . tag(16) . ciphertext )
 *   Cipher : AES-256-GCM (authenticated — ciphertext is tamper-evident)
 *   KDF    : PBKDF2-SHA-256, 100 000 iterations, 32-byte output, per-record random salt
 *   Key    : derived from AUTH_KEY + SECURE_AUTH_SALT (WordPress constants)
 *
 * Format v1 (legacy — read-only, removed on first re-encrypt):
 *   base64( iv(16) . ciphertext )
 *   Cipher : AES-256-CBC  (no auth tag — only accepted for backward-compat decrypt)
 *   KDF    : raw SHA-256 of WP salts
 *
 * Migration: call decrypt() on a v1 record to get the plaintext, then encrypt()
 * to re-encrypt it as v2. New encryptions always produce v2.
 */
class Encryption {

    private const CIPHER_V2  = 'aes-256-gcm';
    private const CIPHER_V1  = 'aes-256-cbc'; // legacy read path only
    private const KDF_ITERS  = 100_000;
    private const TAG_LENGTH = 16;

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * Encrypt $plaintext and return an opaque, self-describing ciphertext string.
     * Always produces v2 format.
     */
    public static function encrypt(string $plaintext): string|false {
        $salt = random_bytes(16);
        $iv   = random_bytes(12); // 96-bit IV for GCM

        $key = self::derive_key_v2($salt);

        $tag        = '';
        $ciphertext = openssl_encrypt(
            $plaintext,
            self::CIPHER_V2,
            $key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            '',
            self::TAG_LENGTH
        );

        if ($ciphertext === false || strlen($tag) !== self::TAG_LENGTH) {
            return false;
        }

        return 'v2:' . base64_encode($salt . $iv . $tag . $ciphertext);
    }

    /**
     * Decrypt a v2 or v1 ciphertext string.
     * Returns the plaintext string, or false on failure.
     */
    public static function decrypt(string $encrypted): string|false {
        if (str_starts_with($encrypted, 'v2:')) {
            return self::decrypt_v2(substr($encrypted, 3));
        }
        return self::decrypt_v1($encrypted);
    }

    // ── Private: v2 (AES-256-GCM + PBKDF2) ─────────────────────────────────

    private static function derive_key_v2(string $salt): string {
        $ikm = self::ikm();
        return hash_pbkdf2('sha256', $ikm, $salt, self::KDF_ITERS, 32, true);
    }

    private static function decrypt_v2(string $b64_payload): string|false {
        $data = base64_decode($b64_payload, true);
        if ($data === false) {
            return false;
        }

        // Layout: salt(16) + iv(12) + tag(16) + ciphertext(variable)
        $min_len = 16 + 12 + self::TAG_LENGTH;
        if (strlen($data) < $min_len) {
            return false;
        }

        $salt       = substr($data, 0, 16);
        $iv         = substr($data, 16, 12);
        $tag        = substr($data, 28, self::TAG_LENGTH);
        $ciphertext = substr($data, 28 + self::TAG_LENGTH);

        $key = self::derive_key_v2($salt);

        $plaintext = openssl_decrypt(
            $ciphertext,
            self::CIPHER_V2,
            $key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag
        );

        // openssl_decrypt returns false when the auth tag doesn't match
        return $plaintext;
    }

    // ── Private: v1 legacy read path (AES-256-CBC + raw SHA-256 KDF) ────────

    private static function derive_key_v1(): string {
        $ikm = self::ikm();
        return hash('sha256', $ikm, true);
    }

    private static function decrypt_v1(string $b64_payload): string|false {
        $data = base64_decode($b64_payload, true);
        if ($data === false) {
            return false;
        }

        $iv_length = openssl_cipher_iv_length(self::CIPHER_V1);
        if (strlen($data) <= $iv_length) {
            return false;
        }

        $iv         = substr($data, 0, $iv_length);
        $ciphertext = substr($data, $iv_length);
        $key        = self::derive_key_v1();

        return openssl_decrypt($ciphertext, self::CIPHER_V1, $key, OPENSSL_RAW_DATA, $iv);
    }

    // ── Shared ───────────────────────────────────────────────────────────────

    private static function ikm(): string {
        $part1 = defined('AUTH_KEY')         ? AUTH_KEY         : 'memorymint-fallback-key';
        $part2 = defined('SECURE_AUTH_SALT') ? SECURE_AUTH_SALT : 'memorymint-fallback-salt';
        return $part1 . $part2;
    }
}
