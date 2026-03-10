<?php
if (!defined('ABSPATH')) {
    exit;
}

global $wpdb;

$network           = get_option('memorymint_network', 'preprod');
$api_key           = \MemoryMint\MemoryMint::get_anvil_api_key();
$production_url    = get_option('memorymint_production_url', '');
$merchant_address  = get_option('memorymint_merchant_address', '');
$keepsake_table   = $wpdb->prefix . 'memorymint_keepsakes';
$wallet_table     = $wpdb->prefix . 'memorymint_policy_wallets';

// ---- User stats -------------------------------------------------------
$total_users    = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->usermeta} WHERE meta_key = 'memorymint_auth_method'");
$email_users    = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->usermeta} WHERE meta_key = 'memorymint_auth_method' AND meta_value = 'email'");
$wallet_users   = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->usermeta} WHERE meta_key = 'memorymint_auth_method' AND meta_value = 'wallet'");

// ---- Keepsake stats ---------------------------------------------------
$total_keepsakes   = (int) $wpdb->get_var("SELECT COUNT(*) FROM $keepsake_table");
$minted_keepsakes  = (int) $wpdb->get_var("SELECT COUNT(*) FROM $keepsake_table WHERE mint_status = 'minted'");
$pending_keepsakes = (int) $wpdb->get_var("SELECT COUNT(*) FROM $keepsake_table WHERE mint_status IN ('pending', 'minting')");
$failed_keepsakes  = (int) $wpdb->get_var("SELECT COUNT(*) FROM $keepsake_table WHERE mint_status = 'failed'");

// ---- Policy wallet ----------------------------------------------------
$active_wallet  = $wpdb->get_row($wpdb->prepare(
    "SELECT * FROM $wallet_table WHERE network = %s AND is_active = 1 LIMIT 1",
    $network
));
$wallet_balance = null;
if ($active_wallet && !empty($api_key)) {
    $anvil          = new \MemoryMint\Services\AnvilService();
    $wallet_balance = $anvil->get_address_balance($active_wallet->payment_address);
}

// ---- Recent keepsakes -------------------------------------------------
$recent = $wpdb->get_results(
    "SELECT k.title, k.mint_status, k.media_type, k.created_at, u.user_email
     FROM $keepsake_table k
     LEFT JOIN {$wpdb->users} u ON k.user_id = u.ID
     ORDER BY k.created_at DESC LIMIT 10"
);

// ---- Helper -----------------------------------------------------------
$status_color = [
    'minted'  => '#00a32a',
    'minting' => '#0073aa',
    'pending' => '#dba617',
    'failed'  => '#d63638',
];
?>

<div class="wrap">
<h1 class="wp-heading-inline">Memory Mint — Overview</h1>
<span style="margin-left:10px; background:<?php echo $network === 'mainnet' ? '#00a32a' : '#0073aa'; ?>; color:#fff; font-size:11px; font-weight:600; padding:2px 10px; border-radius:4px; vertical-align:middle;">
    <?php echo esc_html(strtoupper($network)); ?>
</span>
<hr class="wp-header-end">

<!-- ================================================================
     SYSTEM STATUS
     ================================================================ -->
<h2 style="margin-top:20px; font-size:15px; color:#555; font-weight:600; text-transform:uppercase; letter-spacing:.5px;">System Status</h2>
<div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:28px;">

    <!-- API key -->
    <div style="background:#fff; border:1px solid #ddd; border-radius:6px; padding:14px 20px; min-width:180px;">
        <div style="font-size:12px; color:#777; margin-bottom:4px;">Anvil API Key</div>
        <?php if (!empty($api_key)): ?>
            <div style="color:#00a32a; font-weight:600;">&#10003; Configured</div>
        <?php else: ?>
            <div style="color:#d63638; font-weight:600;">&#10007; Not set</div>
            <div style="margin-top:6px;"><a href="<?php echo esc_url(admin_url('admin.php?page=memory-mint-settings')); ?>" class="button button-small">Configure →</a></div>
        <?php endif; ?>
    </div>

    <!-- Policy wallet -->
    <div style="background:#fff; border:1px solid #ddd; border-radius:6px; padding:14px 20px; min-width:180px;">
        <div style="font-size:12px; color:#777; margin-bottom:4px;">Policy Wallet</div>
        <?php if (!$active_wallet): ?>
            <div style="color:#d63638; font-weight:600;">&#10007; Not configured</div>
            <div style="margin-top:6px;"><a href="<?php echo esc_url(admin_url('admin.php?page=memory-mint-wallet')); ?>" class="button button-small">Generate →</a></div>
        <?php elseif ($wallet_balance === null): ?>
            <div style="color:#777;">Balance unavailable</div>
            <div style="font-size:11px; color:#999; margin-top:2px;">Check API key</div>
        <?php else:
            $bal_color = $wallet_balance >= 10 ? '#00a32a' : ($wallet_balance >= 3 ? '#dba617' : '#d63638');
            $bal_icon  = $wallet_balance >= 10 ? '✓' : ($wallet_balance >= 3 ? '⚠' : '✗');
        ?>
            <div style="color:<?php echo $bal_color; ?>; font-weight:700; font-size:18px;">
                <?php echo $bal_icon . ' ' . number_format($wallet_balance, 2); ?> ADA
            </div>
            <div style="font-size:11px; color:#999; margin-top:2px;">
                <a href="<?php echo esc_url(admin_url('admin.php?page=memory-mint-wallet')); ?>">View wallet →</a>
            </div>
        <?php endif; ?>
    </div>

    <!-- Production URL -->
    <div style="background:#fff; border:1px solid #ddd; border-radius:6px; padding:14px 20px; min-width:180px;">
        <div style="font-size:12px; color:#777; margin-bottom:4px;">Production URL</div>
        <?php if (!empty($production_url)): ?>
            <div style="color:#00a32a; font-weight:600; font-size:12px; word-break:break-all;">&#10003; <?php echo esc_html($production_url); ?></div>
        <?php else: ?>
            <div style="color:#d63638; font-weight:600;">&#10007; Not set</div>
            <div style="font-size:11px; color:#999; margin-top:2px;">Share emails will use localhost</div>
            <div style="margin-top:6px;"><a href="<?php echo esc_url(admin_url('admin.php?page=memory-mint-settings')); ?>" class="button button-small">Set URL →</a></div>
        <?php endif; ?>
    </div>

    <!-- Merchant address -->
    <div style="background:#fff; border:1px solid #ddd; border-radius:6px; padding:14px 20px; min-width:180px;">
        <div style="font-size:12px; color:#777; margin-bottom:4px;">Merchant Address</div>
        <?php if (!empty($merchant_address)): ?>
            <div style="color:#00a32a; font-weight:600;">&#10003; Configured</div>
            <div style="font-size:11px; color:#999; font-family:monospace; margin-top:2px; word-break:break-all;">
                <?php echo esc_html(substr($merchant_address, 0, 14) . '…' . substr($merchant_address, -6)); ?>
            </div>
        <?php else: ?>
            <div style="color:#d63638; font-weight:600;">&#10007; Not set</div>
            <div style="font-size:11px; color:#999; margin-top:2px;">Service fees will have no destination</div>
            <div style="margin-top:6px;"><a href="<?php echo esc_url(admin_url('admin.php?page=memory-mint-settings')); ?>" class="button button-small">Set address →</a></div>
        <?php endif; ?>
    </div>

</div>

<!-- ================================================================
     STATS
     ================================================================ -->
<h2 style="font-size:15px; color:#555; font-weight:600; text-transform:uppercase; letter-spacing:.5px;">Platform Stats</h2>
<div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:28px;">

    <div style="background:#fff; border:1px solid #ddd; border-radius:6px; padding:16px 24px; min-width:140px; text-align:center;">
        <div style="font-size:32px; font-weight:700; color:#333;"><?php echo $total_users; ?></div>
        <div style="color:#777; font-size:13px;">Total Users</div>
    </div>

    <div style="background:#fff; border:1px solid #ddd; border-radius:6px; padding:16px 24px; min-width:140px; text-align:center;">
        <div style="font-size:32px; font-weight:700; color:#0073aa;"><?php echo $email_users; ?></div>
        <div style="color:#777; font-size:13px;">Email Users</div>
    </div>

    <div style="background:#fff; border:1px solid #ddd; border-radius:6px; padding:16px 24px; min-width:140px; text-align:center;">
        <div style="font-size:32px; font-weight:700; color:#8a3ffc;"><?php echo $wallet_users; ?></div>
        <div style="color:#777; font-size:13px;">Wallet Users</div>
    </div>

    <div style="background:#fff; border:1px solid #ddd; border-left:4px solid #333; border-radius:6px; padding:16px 24px; min-width:140px; text-align:center;">
        <div style="font-size:32px; font-weight:700; color:#333;"><?php echo $total_keepsakes; ?></div>
        <div style="color:#777; font-size:13px;">Total Keepsakes</div>
    </div>

    <div style="background:#fff; border:1px solid #ddd; border-left:4px solid #00a32a; border-radius:6px; padding:16px 24px; min-width:140px; text-align:center;">
        <div style="font-size:32px; font-weight:700; color:#00a32a;"><?php echo $minted_keepsakes; ?></div>
        <div style="color:#777; font-size:13px;">Minted</div>
    </div>

    <?php if ($pending_keepsakes > 0): ?>
    <div style="background:#fff; border:1px solid #ddd; border-left:4px solid #dba617; border-radius:6px; padding:16px 24px; min-width:140px; text-align:center;">
        <div style="font-size:32px; font-weight:700; color:#dba617;"><?php echo $pending_keepsakes; ?></div>
        <div style="color:#777; font-size:13px;">Pending / Minting</div>
    </div>
    <?php endif; ?>

    <?php if ($failed_keepsakes > 0): ?>
    <div style="background:#fff; border:1px solid #ddd; border-left:4px solid #d63638; border-radius:6px; padding:16px 24px; min-width:140px; text-align:center;">
        <div style="font-size:32px; font-weight:700; color:#d63638;"><?php echo $failed_keepsakes; ?></div>
        <div style="color:#777; font-size:13px;">Failed</div>
    </div>
    <?php endif; ?>

</div>

<!-- ================================================================
     RECENT ACTIVITY
     ================================================================ -->
<h2 style="font-size:15px; color:#555; font-weight:600; text-transform:uppercase; letter-spacing:.5px;">Recent Keepsakes</h2>

<?php if ($recent): ?>
<table class="widefat fixed striped" cellspacing="0" style="margin-bottom:8px;">
    <thead>
        <tr>
            <th>Title</th>
            <th style="width:200px;">User</th>
            <th style="width:80px;">Type</th>
            <th style="width:100px;">Status</th>
            <th style="width:140px;">Date</th>
        </tr>
    </thead>
    <tbody>
    <?php foreach ($recent as $row):
        $sc = $status_color[$row->mint_status] ?? '#999';
    ?>
        <tr>
            <td><?php echo esc_html($row->title ?: '(untitled)'); ?></td>
            <td style="font-size:12px; color:#555;"><?php echo esc_html($row->user_email ?: '—'); ?></td>
            <td style="font-size:12px;">
                <?php echo esc_html(ucfirst($row->media_type ?? '—')); ?>
            </td>
            <td>
                <span style="background:<?php echo $sc; ?>; color:#fff; font-size:11px; font-weight:600; padding:2px 8px; border-radius:4px;">
                    <?php echo esc_html(strtoupper($row->mint_status)); ?>
                </span>
            </td>
            <td style="font-size:12px; white-space:nowrap;">
                <?php echo esc_html(date_i18n('Y-m-d H:i', strtotime($row->created_at))); ?>
            </td>
        </tr>
    <?php endforeach; ?>
    </tbody>
</table>
<p><a href="<?php echo esc_url(admin_url('admin.php?page=memory-mint-keepsakes')); ?>">View all keepsakes →</a></p>
<?php else: ?>
<p style="color:#777;">No keepsakes yet.</p>
<?php endif; ?>

<!-- ================================================================
     QUICK LINKS
     ================================================================ -->
<h2 style="margin-top:24px; font-size:15px; color:#555; font-weight:600; text-transform:uppercase; letter-spacing:.5px;">Quick Links</h2>
<div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:20px;">
    <a href="<?php echo esc_url(admin_url('admin.php?page=memory-mint-keepsakes')); ?>" class="button button-primary">All Keepsakes</a>
    <a href="<?php echo esc_url(admin_url('admin.php?page=memory-mint-transactions')); ?>" class="button">Transactions</a>
    <a href="<?php echo esc_url(admin_url('admin.php?page=memory-mint-wallet')); ?>" class="button">Policy Wallet</a>
    <a href="<?php echo esc_url(admin_url('admin.php?page=memory-mint-users')); ?>" class="button">Users</a>
    <a href="<?php echo esc_url(admin_url('admin.php?page=memory-mint-settings')); ?>" class="button">Settings</a>
</div>

</div>
