<?php
namespace MemoryMint\Helpers;

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Verifies a CIP-30 signData COSE_Sign1 signature server-side.
 *
 * Implements just enough CBOR decoding and CBOR encoding to parse COSE_Sign1 /
 * COSE_Key structures and rebuild the Sig_Structure for Ed25519 verification via
 * PHP's built-in sodium extension (PHP 7.2+, always present on 8.x).
 *
 * CIP-30 signData contract:
 *   wallet.signData(addressHex, payloadHex) → { signature: hex, key: hex }
 *   - signature = CBOR-encoded COSE_Sign1  (possibly prefixed by CBOR tag 18 = 0xD2)
 *   - key       = CBOR-encoded COSE_Key map
 *
 * Sig_Structure verified (RFC 8152 §4.4):
 *   ["Signature1", bstr(protected_header_cbor), bstr(""), bstr(payload)]
 */
class CoseVerifier {

    /**
     * Verify a CIP-30 signData signature.
     *
     * @param string $cose_sign1_hex    Hex of CBOR COSE_Sign1 (wallet.signData().signature)
     * @param string $cose_key_hex      Hex of CBOR COSE_Key   (wallet.signData().key)
     * @param string $expected_nonce_hex Hex of the nonce bytes we expect the wallet to have signed
     * @param string $raw_address_hex   Hex of the CIP-30 raw address (from getUsedAddresses()[0])
     * @return bool  true only when all checks pass (key, address, payload, signature)
     */
    public static function verify(
        string $cose_sign1_hex,
        string $cose_key_hex,
        string $expected_nonce_hex,
        string $raw_address_hex
    ): bool {
        if (!function_exists('sodium_crypto_sign_verify_detached')) {
            error_log('MemoryMint CoseVerifier: sodium extension unavailable');
            return false;
        }

        $sign1_bytes = @hex2bin($cose_sign1_hex);
        $key_bytes   = @hex2bin($cose_key_hex);
        if ($sign1_bytes === false || $key_bytes === false || $sign1_bytes === '' || $key_bytes === '') {
            return false;
        }

        // 1. Extract 32-byte Ed25519 public key from COSE_Key (map key -2 = x)
        $pub_key = self::extract_public_key($key_bytes);
        if ($pub_key === null || strlen($pub_key) !== 32) {
            return false;
        }

        // 2. Parse COSE_Sign1 into its three fields we need
        $sign1 = self::parse_cose_sign1($sign1_bytes);
        if ($sign1 === null) {
            return false;
        }

        ['protected_bytes' => $protected_bytes, 'payload' => $payload, 'signature' => $signature] = $sign1;

        if (strlen($signature) !== 64) {
            return false;
        }

        // 3. Verify payload matches the nonce we issued
        $expected_nonce = @hex2bin($expected_nonce_hex);
        if ($expected_nonce === false || $payload !== $expected_nonce) {
            return false;
        }

        // 4. Verify address in protected header matches the address that was claimed
        $offset           = 0;
        $protected_map    = self::decode_cbor_item($protected_bytes, $offset);
        $expected_addr    = @hex2bin($raw_address_hex);
        if (!is_array($protected_map) || $expected_addr === false) {
            return false;
        }
        $addr_in_header = $protected_map['address'] ?? null;
        if ($addr_in_header === null || $addr_in_header !== $expected_addr) {
            return false;
        }

        // 5. Rebuild Sig_Structure and verify Ed25519 signature
        $sig_structure = self::build_sig_structure($protected_bytes, $payload);

        return sodium_crypto_sign_verify_detached($signature, $sig_structure, $pub_key);
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private static function extract_public_key(string $cbor_bytes): ?string {
        $offset = 0;
        $map    = self::decode_cbor_item($cbor_bytes, $offset);
        if (!is_array($map)) {
            return null;
        }
        // COSE_Key map: key -2 = x (Ed25519 public key, 32 bytes)
        $x = $map[-2] ?? null;
        return (is_string($x) && strlen($x) === 32) ? $x : null;
    }

    private static function parse_cose_sign1(string $bytes): ?array {
        $offset  = 0;
        $decoded = self::decode_cbor_item($bytes, $offset);
        // COSE_Sign1 is a 4-element array: [protected, unprotected, payload, signature]
        if (!is_array($decoded) || count($decoded) !== 4) {
            return null;
        }
        if (!is_string($decoded[0]) || !is_string($decoded[2]) || !is_string($decoded[3])) {
            return null;
        }
        return [
            'protected_bytes' => $decoded[0],
            'payload'         => $decoded[2],
            'signature'       => $decoded[3],
        ];
    }

    /**
     * CBOR-encode ["Signature1", bstr(protected), bstr(""), bstr(payload)]
     * (RFC 8152 §4.4 Sig_Structure for COSE_Sign1).
     */
    private static function build_sig_structure(string $protected_bytes, string $payload): string {
        return "\x84"                                   // array(4)
            . self::cbor_text('Signature1')
            . self::cbor_bytes($protected_bytes)
            . "\x40"                                    // bstr(0) = empty byte string
            . self::cbor_bytes($payload);
    }

    // ── Minimal CBOR encoder ─────────────────────────────────────────────────

    private static function cbor_text(string $s): string {
        return self::cbor_length_prefix(3, strlen($s)) . $s;
    }

    private static function cbor_bytes(string $b): string {
        return self::cbor_length_prefix(2, strlen($b)) . $b;
    }

    private static function cbor_length_prefix(int $major_type, int $len): string {
        $mt = $major_type << 5;
        if ($len < 24)     return chr($mt | $len);
        if ($len < 256)    return chr($mt | 24) . chr($len);
        if ($len < 65536)  return chr($mt | 25) . pack('n', $len);
        return                    chr($mt | 26) . pack('N', $len);
    }

    // ── Minimal CBOR decoder ─────────────────────────────────────────────────

    /**
     * Decode one CBOR data item from $bytes starting at $offset.
     * Advances $offset past the item on success.
     * Returns the PHP value, or null on unsupported/malformed input.
     *
     * Supported major types: 0-6 (unsigned int, negative int, bstr, tstr, array, map, tag).
     * Tag (major 6) is decoded transparently — the tagged value is returned directly.
     */
    private static function decode_cbor_item(string $bytes, int &$offset): mixed {
        if ($offset >= strlen($bytes)) {
            return null;
        }

        $initial = ord($bytes[$offset++]);
        $major   = $initial >> 5;
        $info    = $initial & 0x1f;

        // Decode the integer argument (count / value)
        if ($info < 24) {
            $value = $info;
        } elseif ($info === 24) {
            $value = ord($bytes[$offset++]);
        } elseif ($info === 25) {
            $value = unpack('n', substr($bytes, $offset, 2))[1];
            $offset += 2;
        } elseif ($info === 26) {
            $value = unpack('N', substr($bytes, $offset, 4))[1];
            $offset += 4;
        } elseif ($info === 27) {
            // 8-byte integer — use PHP_INT_MAX guard for 32-bit builds
            $hi     = unpack('N', substr($bytes, $offset, 4))[1];
            $lo     = unpack('N', substr($bytes, $offset + 4, 4))[1];
            $value  = ($hi << 32) | $lo;
            $offset += 8;
        } else {
            return null; // floats / break / indefinite-length — not needed here
        }

        switch ($major) {
            case 0: // unsigned integer
                return $value;

            case 1: // negative integer: -1 - value
                return -1 - $value;

            case 2: // byte string
                $str     = substr($bytes, $offset, $value);
                $offset += $value;
                return $str;

            case 3: // text string
                $str     = substr($bytes, $offset, $value);
                $offset += $value;
                return $str;

            case 4: // array
                $arr = [];
                for ($i = 0; $i < $value; $i++) {
                    $arr[] = self::decode_cbor_item($bytes, $offset);
                }
                return $arr;

            case 5: // map — keys are integers or strings (PHP handles mixed keys fine)
                $map = [];
                for ($i = 0; $i < $value; $i++) {
                    $k       = self::decode_cbor_item($bytes, $offset);
                    $v       = self::decode_cbor_item($bytes, $offset);
                    $map[$k] = $v;
                }
                return $map;

            case 6: // tag — return the tagged item (we don't validate the tag number)
                return self::decode_cbor_item($bytes, $offset);

            default:
                return null;
        }
    }
}
