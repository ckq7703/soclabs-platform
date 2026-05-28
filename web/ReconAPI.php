<?php


class ReconAPI
{
    private $apiGatewayUrl;
    private $apiKey;

    public function __construct()
    {
        $this->apiGatewayUrl = getenv('API_GATEWAY_URL') ?: 'http://api-gateway:8080';
        $this->apiKey = getenv('API_KEY');
    }

    public function createReconJob($target, $scanType, $options = [])
    {
        $jobData = [
            'target' => $target,
            'scan_type' => $scanType, // subdomain, portscan, vuln_scan, full
            'options' => $options,
            'created_at' => date('Y-m-d H:i:s'),
            'user_id' => $_SESSION['user_id'] ?? 'anonymous'
        ];

        $ch = curl_init($this->apiGatewayUrl . '/api/v1/jobs/create');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($jobData),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'X-API-Key: ' . $this->apiKey
            ]
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 201) {
            return json_decode($response, true);
        }

        throw new Exception("Failed to create job: " . $response);
    }

    public function getJobStatus($jobId)
    {
        $ch = curl_init($this->apiGatewayUrl . "/api/v1/jobs/{$jobId}/status");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'X-API-Key: ' . $this->apiKey
            ]
        ]);

        $response = curl_exec($ch);
        curl_close($ch);

        return json_decode($response, true);
    }

    public function getJobResults($jobId)
    {
        $ch = curl_init($this->apiGatewayUrl . "/api/v1/jobs/{$jobId}/results");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'X-API-Key: ' . $this->apiKey
            ]
        ]);

        $response = curl_exec($ch);
        curl_close($ch);

        return json_decode($response, true);
    }

    public function listJobs($filters = [])
    {
        $queryString = http_build_query($filters);
        $url = $this->apiGatewayUrl . "/api/v1/jobs?" . $queryString;

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'X-API-Key: ' . $this->apiKey
            ]
        ]);

        $response = curl_exec($ch);
        curl_close($ch);

        return json_decode($response, true);
    }

    public function cancelJob($jobId)
    {
        $ch = curl_init($this->apiGatewayUrl . "/api/v1/jobs/{$jobId}");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => "DELETE",
            CURLOPT_HTTPHEADER => [
                'X-API-Key: ' . $this->apiKey
            ]
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200) {
            return json_decode($response, true);
        }

        throw new Exception("Failed to cancel job: " . $response);
    }
}
?>
