<?php
require_once 'ReconAPI.php';

if (!isset($_GET['job_id'])) {
    die("Job ID required");
}

$jobId = $_GET['job_id'];
$recon = new ReconAPI();

try {
    $results = $recon->getJobResults($jobId);
    $status = $recon->getJobStatus($jobId);
}
catch (Exception $e) {
    die("Error fetching results: " . $e->getMessage());
}

?>

<!DOCTYPE html>
<html>

<head>
    <title>Job Results -
        <?= htmlspecialchars($results['target'])?>
    </title>
    <style>
        body {
            font-family: sans-serif;
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: #f5f5f5;
            padding: 20px;
            border-radius: 5px;
            margin-bottom: 20px;
        }

        .section {
            margin-bottom: 30px;
            border: 1px solid #ddd;
            padding: 20px;
            border-radius: 5px;
        }

        pre {
            background: #eee;
            padding: 10px;
            overflow-x: auto;
        }

        .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 3px;
            color: white;
            background: gray;
        }

        .critical {
            background: red;
        }

        .high {
            background: orange;
        }

        .medium {
            background: #dada00;
            color: black;
        }

        .low {
            background: green;
        }
    </style>
</head>

<body>
    <div class="header">
        <h1>Results for:
            <?= htmlspecialchars($results['target'])?>
        </h1>
        <p><strong>Job ID:</strong>
            <?= htmlspecialchars($jobId)?>
        </p>
        <p><strong>Scan Type:</strong>
            <?= htmlspecialchars($results['scan_type'])?>
        </p>
        <p><strong>Completed:</strong>
            <?= htmlspecialchars($status['completed_at'])?>
        </p>
    </div>

    <?php
$data = $results['results'];

// Helper to display subdomains
if (isset($data['subdomains_list']) || isset($data['subdomain_enum']['subdomains_list'])):
    $subs = $data['subdomains_list'] ?? $data['subdomain_enum']['subdomains_list'] ?? [];
?>
    <div class="section">
        <h2>Subdomains Found (
            <?= count($subs)?>)
        </h2>
        <div style="max-height: 300px; overflow-y: auto;">
            <ul>
                <?php foreach ($subs as $sub): ?>
                <li><a href="http://<?= htmlspecialchars($sub)?>" target="_blank">
                        <?= htmlspecialchars($sub)?>
                    </a></li>
                <?php
    endforeach; ?>
            </ul>
        </div>
    </div>
    <?php
endif; ?>

    <?php
// Helper to display open ports
if (isset($data['ports']) || isset($data['port_scan']['ports'])):
    $ports = $data['ports'] ?? $data['port_scan']['ports'] ?? [];
?>
    <div class="section">
        <h2>Open Ports</h2>
        <pre><?= implode("\n", $ports)?></pre>
    </div>
    <?php
endif; ?>

    <?php
// Helper to display vulnerabilities
$vulnSummary = $data['summary'] ?? $data['vuln_scan']['summary'] ?? null;
$vulnFile = $data['output_file'] ?? $data['vuln_scan']['output_file'] ?? null;

if ($vulnSummary):
?>
    <div class="section">
        <h2>Vulnerabilities</h2>
        <p>
            <span class="badge critical">Critical:
                <?= $vulnSummary['critical'] ?? 0?>
            </span>
            <span class="badge high">High:
                <?= $vulnSummary['high'] ?? 0?>
            </span>
            <span class="badge medium">Medium:
                <?= $vulnSummary['medium'] ?? 0?>
            </span>
        </p>
        <?php if ($vulnFile): ?>
        <p>Full results file:
            <?= htmlspecialchars($vulnFile)?>
        </p>
        <!-- In a real app, we would parse and show the JSON details here -->
        <?php
    endif; ?>
    </div>
    <?php
endif; ?>

    <div class="section">
        <h2>Raw Data Dump</h2>
        <pre><?= htmlspecialchars(json_encode($data, JSON_PRETTY_PRINT))?></pre>
    </div>

    <a href="index.php">Back to Dashboard</a>
</body>

</html>