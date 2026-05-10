<?php
namespace MemoryMint\Services;

use MemoryMint\MemoryMint;

if (!defined('ABSPATH')) {
    exit;
}

class AnvilService {

    private $api_key;
    private $base_url;

    public function __construct() {
        $network = MemoryMint::get_network();
        $this->api_key = MemoryMint::get_anvil_api_key();
        $this->base_url = $network === 'mainnet'
            ? 'https://api.ada-anvil.app/v1'
            : 'https://preprod.api.ada-anvil.app/v1';
    }

    /**
     * Build a minting transaction via Anvil API.
     */
    public function build_mint_transaction($params) {
        // policy_id is the blake2b-224 hash of the CBOR-encoded native script.
        // Fall back to payment_keyhash for wallets generated before this was stored.
        $policy_id = !empty($params['policy_id']) ? $params['policy_id'] : $params['policy_keyhash'];

        // Determine fee payer:
        //   - Wallet users:    user_address is changeAddress (they fund the tx).
        //   - Custodial users: fee_payer_address (policy wallet) is changeAddress so
        //                      the email user never needs ADA in their custodial wallet.
        $is_policy_funded = !empty($params['fee_payer_address']);
        $change_address   = $is_policy_funded ? $params['fee_payer_address'] : $params['user_address'];

        $outputs = [
            [
                'address' => $params['merchant_address'],
                'lovelace' => $params['service_fee_lovelace'],
            ],
        ];

        // When the policy wallet pays, we must explicitly route the minted NFT to the
        // user's custodial address (otherwise the asset lands in the policy wallet's change).
        // 2 ADA is the Cardano minimum UTXO value for a native-asset output.
        if ($is_policy_funded) {
            $outputs[] = [
                'address'  => $params['user_address'],
                'lovelace' => 2000000,
                'assets'   => [
                    [
                        'policyId'  => $policy_id,
                        'assetName' => $params['asset_name'],
                        'quantity'  => 1,
                    ],
                ],
            ];
        }

        $payload = [
            'changeAddress' => $change_address,
            'outputs'       => $outputs,
            'mint'          => [
                [
                    'policyId' => $policy_id,
                    'assets'   => [
                        [
                            'assetName' => $params['asset_name'],
                            'quantity'  => 1,
                        ],
                    ],
                ],
            ],
            // TODO (L4): migrate to CIP-68 (label 100/222/333) before mainnet launch.
            'metadata' => [
                721 => [
                    $policy_id => [
                        $params['asset_name'] => $params['metadata'],
                    ],
                ],
            ],
        ];

        // Add policy JSON (native script) so Anvil can validate the minting policy
        if (!empty($params['policy_json'])) {
            $policy = json_decode($params['policy_json'], true);
            if ($policy) {
                $payload['nativeScripts'] = [$policy];
            }
        }

        $response = $this->call('POST', '/services/txs/build', $payload);

        if (!$response['success']) {
            return $response;
        }

        return [
            'success' => true,
            'unsigned_tx' => $response['data']['tx'] ?? $response['data']['cborHex'] ?? '',
            'network_fee' => isset($response['data']['fee']) ? $response['data']['fee'] / 1000000 : 0.2,
        ];
    }

    /**
     * Submit a signed transaction to the blockchain.
     */
    public function submit_transaction($params) {
        $payload = [
            'tx' => $params['signed_tx'],
        ];

        // Callers may pass either:
        //   'witnesses' => [hex, ...]           – direct array (e.g. policy-only custodial mint)
        //   'customer_witness' + 'policy_witness' – legacy two-key path (wallet users)
        if (!empty($params['witnesses'])) {
            $payload['witnesses'] = array_values(array_filter($params['witnesses']));
        } elseif (!empty($params['customer_witness'])) {
            $payload['witnesses'] = [$params['customer_witness']];
            if (!empty($params['policy_witness'])) {
                $payload['witnesses'][] = $params['policy_witness'];
            }
        }

        $response = $this->call('POST', '/services/txs/submit', $payload);

        if (!$response['success']) {
            return $response;
        }

        return [
            'success' => true,
            'tx_hash' => $response['data']['txHash'] ?? $response['data']['hash'] ?? '',
            'asset_id' => $response['data']['assetId'] ?? '',
        ];
    }

    /**
     * Get current ADA price in USD from CoinGecko.
     * Cached for 5 minutes. Falls back to last known price if it is ≤24 hours old.
     * Returns null when no fresh-enough price is available — callers must abort.
     */
    public function get_ada_price(): ?float {
        $cached = get_transient('memorymint_ada_price');
        if ($cached !== false) {
            return floatval($cached);
        }

        $response = wp_remote_get('https://api.coingecko.com/api/v3/simple/price?ids=cardano&vs_currencies=usd', [
            'timeout' => 10,
        ]);

        if (!is_wp_error($response)) {
            $body  = json_decode(wp_remote_retrieve_body($response), true);
            $price = $body['cardano']['usd'] ?? null;

            if ($price) {
                set_transient('memorymint_ada_price', $price, 5 * MINUTE_IN_SECONDS);
                update_option('memorymint_last_ada_price', $price);
                update_option('memorymint_last_ada_price_time', time());
                return floatval($price);
            }
        }

        // CoinGecko unavailable — fall back to last known price only if ≤24 hours old.
        $last_price = get_option('memorymint_last_ada_price', '');
        $last_time  = intval(get_option('memorymint_last_ada_price_time', 0));

        if ($last_price && $last_time && (time() - $last_time) < DAY_IN_SECONDS) {
            return floatval($last_price);
        }

        // Price is too stale or was never fetched — signal callers to abort.
        return null;
    }

    /**
     * Get the ADA balance of a wallet address.
     * Cached for 5 minutes. Returns ADA as float, or null on error.
     */
    public function get_address_balance(string $address): ?float {
        $cache_key = 'memorymint_wallet_balance_' . md5($address);
        $cached    = get_transient($cache_key);
        if ($cached !== false) {
            return floatval($cached);
        }

        $result = $this->call('GET', '/addresses/' . rawurlencode($address));

        if (!$result['success'] || empty($result['data'])) {
            return null;
        }

        $lovelace = 0;
        foreach ((array) ($result['data']['amount'] ?? []) as $item) {
            if (($item['unit'] ?? '') === 'lovelace') {
                $lovelace = intval($item['quantity']);
                break;
            }
        }

        $ada = $lovelace / 1_000_000;
        set_transient($cache_key, $ada, 5 * MINUTE_IN_SECONDS);
        return $ada;
    }

    /**
     * Verify a transaction exists on the blockchain.
     */
    public function verify_transaction($tx_hash) {
        $response = $this->call('GET', '/services/txs/' . $tx_hash);
        return $response['success'] ? $response['data'] : null;
    }

    /**
     * Test API connectivity.
     */
    public function test_health() {
        return $this->call('GET', '/services/health');
    }

    /**
     * Make an API call to Anvil.
     */
    private function call($method, $endpoint, $body = null) {
        $url = $this->base_url . $endpoint;

        $args = [
            'method' => $method,
            'headers' => [
                'Authorization' => 'Bearer ' . $this->api_key,
                'Content-Type' => 'application/json',
            ],
            'timeout' => 30,
        ];

        if ($body && $method !== 'GET') {
            $args['body'] = wp_json_encode($body);
        }

        $response = wp_remote_request($url, $args);

        if (is_wp_error($response)) {
            return [
                'success' => false,
                'error' => $response->get_error_message(),
            ];
        }

        $code = wp_remote_retrieve_response_code($response);
        $data = json_decode(wp_remote_retrieve_body($response), true);

        if ($code >= 200 && $code < 300) {
            return [
                'success' => true,
                'data' => $data,
            ];
        }

        return [
            'success' => false,
            'error' => $data['message'] ?? $data['error'] ?? "HTTP $code",
            'code' => $code,
        ];
    }
}
