<?php
require_once 'ReconAPI.php';

$recon = new ReconAPI();

// Handle Form Submission
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['target'])) {
    header('Content-Type: application/json');
    try {
        $job = $recon->createReconJob(
            $_POST['target'],
            $_POST['scan_type'],
        [
            'timeout' => 3600,
            'threads' => 10,
            'resolvers' => '/opt/resolvers.txt'
        ]
        );

        echo json_encode([
            'success' => true,
            'job_id' => $job['job_id'],
            'status' => 'queued'
        ]);
    }
    catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// Handle AJAX Status Check
if (isset($_GET['action']) && $_GET['action'] === 'status' && isset($_GET['job_id'])) {
    header('Content-Type: application/json');
    echo json_encode($recon->getJobStatus($_GET['job_id']));
    exit;
}

if (isset($_POST['action']) && $_POST['action'] === 'cancel' && isset($_POST['job_id'])) {
    header('Content-Type: application/json');
    try {
        echo json_encode($recon->cancelJob($_POST['job_id']));
    }
    catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit;
}

// Fetch Jobs
$jobsData = $recon->listJobs(['limit' => 50]);
$jobs = $jobsData['jobs'] ?? [];
?>

<!DOCTYPE html>
<html>

<head>
    <title>Recon Automation Platform</title>
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <style>
        body {
            font-family: sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }

        .job {
            border: 1px solid #ccc;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 5px;
        }

        .status {
            font-weight: bold;
        }

        .completed {
            color: green;
        }

        .running {
            color: blue;
        }

        .failed {
            color: red;
        }

        form {
            margin-bottom: 30px;
            padding: 20px;
            background: #f5f5f5;
            border-radius: 5px;
        }

        input,
        select,
        button {
            padding: 8px;
            margin-right: 10px;
        }
    </style>
</head>

<body>
    <h1>Recon Automation Dashboard</h1>

    <form id="recon-form">
        <input type="text" name="target" placeholder="target.com" required>
        <select name="scan_type">
            <option value="subdomain">Subdomain Enumeration</option>
            <option value="portscan">Port Scan</option>
            <option value="vuln_scan">Vulnerability Scan</option>
            <option value="tech_detect">Technology Detection</option>
            <option value="waf_detect">WAF Detection</option>
            <option value="full">Full Recon</option>
        </select>
        <button type="submit">Start Scan</button>
    </form>

    <h2>Recent Jobs</h2>
    <div id="jobs-list">
        <?php foreach ($jobs as $job): ?>
        <div class="job" data-job-id="<?= $job['job_id']?>">
            <h3>
                <?= htmlspecialchars($job['target'])?> <small>(
                    <?= htmlspecialchars($job['scan_type'])?>)
                </small>
            </h3>
            <p>ID:
                <?= htmlspecialchars($job['job_id'])?>
            </p>
            <p>Status: <span class="status <?= htmlspecialchars($job['status'])?>">
                    <?= htmlspecialchars($job['status'])?>
                </span></p>
            <p>Progress: <span class="progress">
                    <?= htmlspecialchars($job['progress'] ?? 0)?>%
                </span></p>
            <p>Created:
                <?= htmlspecialchars($job['created_at'])?>
            </p>
            <button onclick="viewResults('<?= $job['job_id']?>')">View Results</button>
            <?php if (in_array($job['status'], ['queued', 'running'])): ?>
            <button onclick="cancelJob('<?= $job['job_id']?>')"
                style="background-color: #ff4444; color: white;">Cancel</button>
            <?php
    endif; ?>
        </div>
        <?php
endforeach; ?>
    </div>

    <script>
        $('#recon-form').submit(function (e) {
            e.preventDefault();
            $.post('', $(this).serialize(), function (data) {
                if (data.success) {
                    alert('Job created: ' + data.job_id);
                    location.reload();
                }
            }, 'json').fail(function (xhr) {
                alert('Error: ' + xhr.responseText);
            });
        });

        function pollJobStatus(jobId) {
            setInterval(function () {
                $.get('?action=status&job_id=' + jobId, function (data) {
                    var el = $('.job[data-job-id="' + jobId + '"]');
                    el.find('.status').text(data.status).attr('class', 'status ' + data.status);
                    el.find('.progress').text((data.progress || 0) + '%');
                }, 'json');
            }, 5000);
        }

        // Auto-poll running jobs
        $('.job').each(function () {
            var status = $(this).find('.status').text();
            var jobId = $(this).data('job-id');
            if (status === 'running' || status === 'queued') {
                pollJobStatus(jobId);
            }
        });

        function viewResults(jobId) {
            window.location.href = 'results.php?job_id=' + jobId;
        }
    </script>
</body>

</html>