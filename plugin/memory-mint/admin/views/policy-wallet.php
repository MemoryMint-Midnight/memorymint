<?php
if (!defined('ABSPATH')) {
    exit;
}

global $wpdb;
$table = $wpdb->prefix . 'memorymint_policy_wallets';
$network = get_option('memorymint_network', 'preprod');

$wallets = $wpdb->get_results($wpdb->prepare(
    "SELECT * FROM $table WHERE network = %s ORDER BY is_active DESC, created_at DESC",
    $network
));

$generated    = isset($_GET['generated'])  && $_GET['generated']  === '1';
$diagnosed    = isset($_GET['diagnosed'])  && $_GET['diagnosed']  === '1';
$new_mnemonic = get_transient('memorymint_new_wallet_mnemonic');
if ($new_mnemonic && $generated) {
    delete_transient('memorymint_new_wallet_mnemonic');
}
$diag_result = get_transient('memorymint_balance_diagnostic');

$error = isset($_GET['error']) ? sanitize_text_field($_GET['error']) : '';

// Find the active wallet for balance display
$active_wallet = null;
foreach ($wallets as $w) {
    if ($w->is_active) { $active_wallet = $w; break; }
}

// Bust balance cache if refresh was requested
if (isset($_GET['refresh_balance'])
    && wp_verify_nonce(sanitize_text_field($_GET['_wpnonce'] ?? ''), 'memorymint_refresh_balance')
    && $active_wallet) {
    delete_transient('memorymint_wallet_balance_' . md5($active_wallet->payment_address));
}

// Fetch balance (uses 5-min transient cache)
$wallet_balance = null;
$balance_error  = false;
if ($active_wallet) {
    $anvil          = new \MemoryMint\Services\AnvilService();
    $wallet_balance = $anvil->get_address_balance($active_wallet->payment_address);
    $balance_error  = ($wallet_balance === null);
}

$refresh_url = wp_nonce_url(
    add_query_arg('refresh_balance', '1', admin_url('admin.php?page=memory-mint-wallet')),
    'memorymint_refresh_balance'
);
?>

<div class="wrap memorymint-admin">
    <h1>Policy Wallet Management</h1>

    <?php if ($generated && $new_mnemonic): ?>
        <div class="notice notice-warning">
            <h3 style="color: #d63638;">IMPORTANT: Save Your Seed Phrase Now!</h3>
            <p>This is the <strong>only time</strong> your 24-word seed phrase will be displayed. Write it down and store it securely. It will not be shown again.</p>
            <div style="background: #1d2327; color: #50c878; padding: 16px; font-family: monospace; font-size: 16px; border-radius: 4px; margin: 10px 0; word-spacing: 8px; line-height: 2;">
                <?php echo esc_html($new_mnemonic); ?>
            </div>
            <p><strong>I have saved my seed phrase in a secure location.</strong></p>
        </div>
    <?php endif; ?>

    <?php if ($error === 'generation_failed'): ?>
        <div class="notice notice-error is-dismissible">
            <p><strong>Wallet generation failed.</strong> Please try again.</p>
        </div>
    <?php endif; ?>

    <div class="notice notice-info" style="margin: 12px 0;">
        <p>
            <strong>How the policy wallet is used:</strong>
            The policy wallet signs every mint transaction as the minting authority.
            For email (custodial) users it also <strong>funds the transaction</strong>, so their wallets never need ADA.
            For browser-wallet users it co-signs alongside the user's wallet.
            <br><br>
            <strong>Keep this wallet funded</strong> — it must hold enough ADA to cover the NFT output (≥&nbsp;2&nbsp;ADA) plus Cardano network fees (~&nbsp;0.2&nbsp;ADA) per mint for custodial users.
            Send ADA to the <em>Payment Address</em> shown in the table below.
        </p>
    </div>

    <h2>Generate New Policy Wallet</h2>
    <p>Create a new wallet for signing minting transactions on <strong><?php echo esc_html(ucfirst($network)); ?></strong>. The previous active wallet will be deactivated.</p>

    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
        <?php wp_nonce_field('memorymint_generate_wallet'); ?>
        <input type="hidden" name="action" value="memorymint_generate_wallet" />
        <table class="form-table">
            <tr>
                <th><label for="wallet_name">Wallet Name</label></th>
                <td>
                    <input type="text" name="wallet_name" id="wallet_name" value="Policy Wallet" class="regular-text" />
                    <p class="description">A friendly name for this wallet.</p>
                </td>
            </tr>
            <?php if ($network === 'mainnet'): ?>
            <tr>
                <th><label for="before_slot">Before Slot (Time-Lock)</label></th>
                <td>
                    <input type="number" name="before_slot" id="before_slot" value="" class="regular-text" min="1" placeholder="e.g. 350000000" />
                    <p class="description">
                        <strong>Recommended for mainnet.</strong> Enter a future Cardano slot number — no NFTs can be minted after that slot.
                        Leave blank to generate without a time-lock (not recommended — unlimited minting if the key is compromised).
                        Current mainnet slot ≈ <code><?php echo esc_html((string) (time() - 1591566291)); ?></code>.
                        A slot ~5 years out ≈ <code><?php echo esc_html((string) (time() - 1591566291 + 157680000)); ?></code>.
                    </p>
                </td>
            </tr>
            <?php endif; ?>
        </table>
        <?php submit_button('Generate New Wallet', 'primary', 'submit', true, [
            'onclick' => "return confirm('This will deactivate the current wallet and generate a new one. Continue?');"
        ]); ?>
    </form>

    <hr />

    <h2>Existing Wallets (<?php echo esc_html(ucfirst($network)); ?>)</h2>

    <?php if ($network === 'mainnet' && $active_wallet):
        $policy_data  = json_decode($active_wallet->policy_json ?? '{}', true);
        $has_timelock = isset($policy_data['type']) && $policy_data['type'] === 'all';
        if (!$has_timelock):
    ?>
        <div class="notice notice-warning" style="margin:12px 0;">
            <p>
                <strong>No time-lock on mainnet policy.</strong>
                The active mainnet policy wallet has no expiry slot — anyone who compromises the signing key can mint indefinitely.
                Regenerate the policy wallet with a <em>Before Slot</em> time-lock before mainnet launch.
            </p>
        </div>
    <?php endif; endif; ?>

    <?php if ($wallet_balance !== null && $wallet_balance < 5): ?>
        <div class="notice notice-error" style="margin:12px 0;">
            <p>
                <strong>Policy wallet is low: <?php echo esc_html(number_format($wallet_balance, 2)); ?> ADA.</strong>
                Custodial mints need ≥2.2 ADA each — top up now to prevent failures.<br>
                Send ADA to: <code><?php echo esc_html($active_wallet->payment_address); ?></code>
            </p>
        </div>
    <?php endif; ?>

    <?php if (empty($wallets)): ?>
        <p>No policy wallets found for <?php echo esc_html($network); ?>. Generate one above to start minting.</p>
    <?php else: ?>
        <table class="wp-list-table widefat fixed striped">
            <thead>
                <tr>
                    <th style="width:40px">ID</th>
                    <th>Name</th>
                    <th>Payment Address</th>
                    <th>Policy ID</th>
                    <th>Balance</th>
                    <th>Status</th>
                    <th>Created</th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($wallets as $w): ?>
                    <tr>
                        <td><?php echo intval($w->id); ?></td>
                        <td><strong><?php echo esc_html($w->wallet_name); ?></strong></td>
                        <td>
                            <code style="font-size: 11px; word-break: break-all;">
                                <?php echo esc_html($w->payment_address); ?>
                            </code>
                        </td>
                        <td>
                            <?php if ($w->policy_id): ?>
                                <code style="font-size: 11px;"><?php echo esc_html(substr($w->policy_id, 0, 20) . '...'); ?></code>
                            <?php else: ?>
                                <em>Not generated</em>
                            <?php endif; ?>
                        </td>
                        <td>
                            <?php if (!$w->is_active): ?>
                                <span style="color:#999;">—</span>
                            <?php elseif ($balance_error): ?>
                                <span style="color:#d63638;" title="Could not reach Anvil API">⚠ Unavailable</span>
                            <?php else:
                                $bal_color = $wallet_balance >= 10 ? '#00a32a' : ($wallet_balance >= 5 ? '#dba617' : '#d63638');
                                $bal_icon  = $wallet_balance >= 10 ? '✓' : ($wallet_balance >= 5 ? '⚠' : '✗');
                            ?>
                                <strong style="color:<?php echo $bal_color; ?>">
                                    <?php echo esc_html($bal_icon . ' ' . number_format($wallet_balance, 2)); ?> ADA
                                </strong>
                            <?php endif; ?>
                        </td>
                        <td>
                            <?php if ($w->is_active): ?>
                                <span style="color: #00a32a; font-weight: bold;">Active</span>
                            <?php else: ?>
                                <span style="color: #999;">Inactive</span>
                            <?php endif; ?>
                        </td>
                        <td><?php echo esc_html(date('M j, Y', strtotime($w->created_at))); ?></td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
        <p style="margin-top:8px;">
            <a href="<?php echo esc_url($refresh_url); ?>">↻ Refresh balance</a>
            <span style="color:#666; font-size:12px; margin-left:8px;">Cached for 5 minutes</span>
            &nbsp;&nbsp;|&nbsp;&nbsp;
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline;">
                <?php wp_nonce_field('memorymint_diagnose_balance'); ?>
                <input type="hidden" name="action" value="memorymint_diagnose_balance" />
                <button type="submit" class="button button-small">&#128270; Run Diagnostics</button>
            </form>
        </p>
    <?php endif; ?>

    <?php if ($diag_result): ?>
        <?php
        $http_code  = $diag_result['http_code'] ?? null;
        $diag_color = '#00a32a';
        if (empty($http_code) || $http_code >= 400) $diag_color = '#d63638';
        elseif (isset($diag_result['lovelace_found']) === false) $diag_color = '#dba617';
        ?>
        <div style="background:#fff; border:1px solid <?php echo $diag_color; ?>; border-left:4px solid <?php echo $diag_color; ?>; border-radius:6px; padding:16px 20px; margin-top:12px;">
            <strong style="font-size:13px;">Balance Diagnostic — <?php echo esc_html($diag_result['timestamp']); ?> (<?php echo esc_html(strtoupper($diag_result['network'] ?? '')); ?>)</strong>

            <table style="margin-top:10px; border-collapse:collapse; width:100%; font-size:12px;">
                <?php if (!empty($diag_result['api_key_preview'])): ?>
                <tr><td style="padding:3px 12px 3px 0; color:#555; white-space:nowrap;">API Key (preview)</td>
                    <td><code><?php echo esc_html($diag_result['api_key_preview']); ?></code></td></tr>
                <?php endif; ?>
                <?php if (!empty($diag_result['address'])): ?>
                <tr><td style="padding:3px 12px 3px 0; color:#555; white-space:nowrap;">Address</td>
                    <td style="word-break:break-all;"><code><?php echo esc_html($diag_result['address']); ?></code></td></tr>
                <?php endif; ?>
                <?php if (!empty($diag_result['url'])): ?>
                <tr><td style="padding:3px 12px 3px 0; color:#555; white-space:nowrap;">Request URL</td>
                    <td style="word-break:break-all;"><code><?php echo esc_html($diag_result['url']); ?></code></td></tr>
                <?php endif; ?>
                <?php if (isset($diag_result['http_code'])): ?>
                <tr><td style="padding:3px 12px 3px 0; color:#555; white-space:nowrap;">HTTP Status</td>
                    <td><strong style="color:<?php echo $diag_color; ?>"><?php echo intval($diag_result['http_code']); ?></strong></td></tr>
                <?php endif; ?>
                <?php if (isset($diag_result['lovelace_found'])): ?>
                <tr><td style="padding:3px 12px 3px 0; color:#555; white-space:nowrap;">Lovelace parsed</td>
                    <td><strong style="color:#00a32a;"><?php echo number_format($diag_result['lovelace_found']); ?> lovelace = <?php echo esc_html(number_format($diag_result['ada'], 6)); ?> ADA</strong></td></tr>
                <?php endif; ?>
                <?php if (!empty($diag_result['message'])): ?>
                <tr><td style="padding:3px 12px 3px 0; color:#555; white-space:nowrap;">Message</td>
                    <td style="color:#d63638;"><?php echo esc_html($diag_result['message']); ?></td></tr>
                <?php endif; ?>
            </table>

            <?php if (!empty($diag_result['response_body'])): ?>
            <div style="margin-top:10px;">
                <strong style="font-size:12px; color:#555;">Raw API Response (first 800 chars):</strong>
                <pre style="background:#1d2327; color:#ccc; padding:10px; font-size:11px; overflow-x:auto; border-radius:4px; margin-top:6px; white-space:pre-wrap; word-break:break-all;"><?php echo esc_html($diag_result['response_body']); ?></pre>
            </div>
            <?php endif; ?>
        </div>
    <?php endif; ?>
</div>
