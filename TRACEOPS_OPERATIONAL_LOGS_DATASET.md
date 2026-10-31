# TRACEOPS Operational Investigation Dataset

## 1. Active Alerts
`json
[
  {
    "id": 1,
    "ts": "2026-10-30T14:16:00Z",
    "service_id": "checkout-api",
    "name": "checkout_latency_p95_high",
    "severity": "CRITICAL",
    "observed": 2.45
  },
  {
    "id": 2,
    "ts": "2026-10-30T14:18:00Z",
    "service_id": "checkout-api",
    "name": "checkout_error_rate_high",
    "severity": "CRITICAL",
    "observed": 0.078
  },
  {
    "id": 3,
    "ts": "2026-10-30T14:19:00Z",
    "service_id": "payment-service",
    "name": "payment_error_rate_high",
    "severity": "CRITICAL",
    "observed": 0.089
  },
  {
    "id": 4,
    "ts": "2026-10-30T14:21:00Z",
    "service_id": "api-gateway",
    "name": "gateway_5xx_rate_high",
    "severity": "HIGH",
    "observed": 0.065
  }
]
`

## 2. Deployments & Revisions
`json
[
  {
    "id": 1,
    "ts": "2026-10-30T14:00:00Z",
    "service_id": "checkout-api",
    "version": "v2.14.0",
    "prev_version": "v2.13.9",
    "rollout_pct": 50.0,
    "summary": "Checkout payment flow optimization & tax update"
  }
]
`

## 3. Configuration Changes
`json
[
  {
    "id": 1,
    "ts": "2026-10-30T14:07:00Z",
    "service_id": "payment-service",
    "key": "db.pool.max_connections",
    "old": "50",
    "new": "10",
    "note": "Scheduled connection pool consolidation for resource balancing"
  }
]
`

## 4. Error & Warning Logs (Incident Signals)
`json
[
  {
    "id": 12,
    "ts": "2026-10-30T13:37:09Z",
    "service_id": "payment-service",
    "level": "ERROR",
    "message": "PoolTimeoutError: timed out after 5000ms waiting for connection (pool=10/10)",
    "trace_id": "trc-0061"
  },
  {
    "id": 13,
    "ts": "2026-10-30T13:37:09Z",
    "service_id": "checkout-api",
    "level": "ERROR",
    "message": "PaymentGatewayError: Downstream call to payment-service failed for order trc-0061",
    "trace_id": "trc-0061"
  },
  {
    "id": 24,
    "ts": "2026-10-30T14:00:48Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0084"
  },
  {
    "id": 7,
    "ts": "2026-10-30T14:02:18Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0035"
  },
  {
    "id": 35,
    "ts": "2026-10-30T14:05:52Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0135"
  },
  {
    "id": 27,
    "ts": "2026-10-30T14:07:09Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0101"
  },
  {
    "id": 29,
    "ts": "2026-10-30T14:07:49Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0107"
  },
  {
    "id": 20,
    "ts": "2026-10-30T14:12:33Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0074"
  },
  {
    "id": 10,
    "ts": "2026-10-30T14:13:37Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0042"
  },
  {
    "id": 72,
    "ts": "2026-10-30T14:14:25Z",
    "service_id": "payment-service",
    "level": "ERROR",
    "message": "PoolTimeoutError: timed out after 5000ms waiting for connection (pool=10/10)",
    "trace_id": "trc-0257"
  },
  {
    "id": 73,
    "ts": "2026-10-30T14:14:25Z",
    "service_id": "checkout-api",
    "level": "ERROR",
    "message": "PaymentGatewayError: Downstream call to payment-service failed for order trc-0257",
    "trace_id": "trc-0257"
  },
  {
    "id": 108,
    "ts": "2026-10-30T14:14:29Z",
    "service_id": "payment-service",
    "level": "ERROR",
    "message": "PoolTimeoutError: timed out after 5000ms waiting for connection (pool=10/10)",
    "trace_id": "trc-0315"
  },
  {
    "id": 109,
    "ts": "2026-10-30T14:14:29Z",
    "service_id": "checkout-api",
    "level": "ERROR",
    "message": "PaymentGatewayError: Downstream call to payment-service failed for order trc-0315",
    "trace_id": "trc-0315"
  },
  {
    "id": 120,
    "ts": "2026-10-30T14:14:32Z",
    "service_id": "payment-service",
    "level": "ERROR",
    "message": "PoolTimeoutError: timed out after 5000ms waiting for connection (pool=10/10)",
    "trace_id": "trc-0338"
  },
  {
    "id": 121,
    "ts": "2026-10-30T14:14:32Z",
    "service_id": "checkout-api",
    "level": "ERROR",
    "message": "PaymentGatewayError: Downstream call to payment-service failed for order trc-0338",
    "trace_id": "trc-0338"
  },
  {
    "id": 146,
    "ts": "2026-10-30T14:14:34Z",
    "service_id": "payment-service",
    "level": "ERROR",
    "message": "PoolTimeoutError: timed out after 5000ms waiting for connection (pool=10/10)",
    "trace_id": "trc-0385"
  },
  {
    "id": 147,
    "ts": "2026-10-30T14:14:34Z",
    "service_id": "checkout-api",
    "level": "ERROR",
    "message": "PaymentGatewayError: Downstream call to payment-service failed for order trc-0385",
    "trace_id": "trc-0385"
  },
  {
    "id": 74,
    "ts": "2026-10-30T14:16:28Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0261"
  },
  {
    "id": 54,
    "ts": "2026-10-30T14:16:58Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0218"
  },
  {
    "id": 55,
    "ts": "2026-10-30T14:17:02Z",
    "service_id": "payment-service",
    "level": "ERROR",
    "message": "PoolTimeoutError: timed out after 5000ms waiting for connection (pool=10/10)",
    "trace_id": "trc-0223"
  },
  {
    "id": 56,
    "ts": "2026-10-30T14:17:02Z",
    "service_id": "checkout-api",
    "level": "ERROR",
    "message": "PaymentGatewayError: Downstream call to payment-service failed for order trc-0223",
    "trace_id": "trc-0223"
  },
  {
    "id": 51,
    "ts": "2026-10-30T14:19:18Z",
    "service_id": "payment-service",
    "level": "ERROR",
    "message": "PoolTimeoutError: timed out after 5000ms waiting for connection (pool=10/10)",
    "trace_id": "trc-0212"
  },
  {
    "id": 52,
    "ts": "2026-10-30T14:19:18Z",
    "service_id": "checkout-api",
    "level": "ERROR",
    "message": "PaymentGatewayError: Downstream call to payment-service failed for order trc-0212",
    "trace_id": "trc-0212"
  },
  {
    "id": 136,
    "ts": "2026-10-30T14:19:21Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0373"
  },
  {
    "id": 144,
    "ts": "2026-10-30T14:21:44Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0383"
  },
  {
    "id": 50,
    "ts": "2026-10-30T14:21:54Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0207"
  },
  {
    "id": 47,
    "ts": "2026-10-30T14:22:09Z",
    "service_id": "payment-service",
    "level": "ERROR",
    "message": "PoolTimeoutError: timed out after 5000ms waiting for connection (pool=10/10)",
    "trace_id": "trc-0201"
  },
  {
    "id": 48,
    "ts": "2026-10-30T14:22:09Z",
    "service_id": "checkout-api",
    "level": "ERROR",
    "message": "PaymentGatewayError: Downstream call to payment-service failed for order trc-0201",
    "trace_id": "trc-0201"
  },
  {
    "id": 127,
    "ts": "2026-10-30T14:22:09Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0350"
  },
  {
    "id": 95,
    "ts": "2026-10-30T14:22:17Z",
    "service_id": "payment-service",
    "level": "ERROR",
    "message": "PoolTimeoutError: timed out after 5000ms waiting for connection (pool=10/10)",
    "trace_id": "trc-0291"
  },
  {
    "id": 96,
    "ts": "2026-10-30T14:22:17Z",
    "service_id": "checkout-api",
    "level": "ERROR",
    "message": "PaymentGatewayError: Downstream call to payment-service failed for order trc-0291",
    "trace_id": "trc-0291"
  },
  {
    "id": 86,
    "ts": "2026-10-30T14:22:28Z",
    "service_id": "payment-service",
    "level": "ERROR",
    "message": "PoolTimeoutError: timed out after 5000ms waiting for connection (pool=10/10)",
    "trace_id": "trc-0275"
  },
  {
    "id": 87,
    "ts": "2026-10-30T14:22:28Z",
    "service_id": "checkout-api",
    "level": "ERROR",
    "message": "PaymentGatewayError: Downstream call to payment-service failed for order trc-0275",
    "trace_id": "trc-0275"
  },
  {
    "id": 140,
    "ts": "2026-10-30T14:22:48Z",
    "service_id": "payment-service",
    "level": "ERROR",
    "message": "PoolTimeoutError: timed out after 5000ms waiting for connection (pool=10/10)",
    "trace_id": "trc-0379"
  },
  {
    "id": 141,
    "ts": "2026-10-30T14:22:48Z",
    "service_id": "checkout-api",
    "level": "ERROR",
    "message": "PaymentGatewayError: Downstream call to payment-service failed for order trc-0379",
    "trace_id": "trc-0379"
  },
  {
    "id": 58,
    "ts": "2026-10-30T14:23:44Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0226"
  },
  {
    "id": 152,
    "ts": "2026-10-30T14:24:15Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0395"
  },
  {
    "id": 100,
    "ts": "2026-10-30T14:24:20Z",
    "service_id": "payment-service",
    "level": "ERROR",
    "message": "PoolTimeoutError: timed out after 5000ms waiting for connection (pool=10/10)",
    "trace_id": "trc-0298"
  },
  {
    "id": 101,
    "ts": "2026-10-30T14:24:20Z",
    "service_id": "checkout-api",
    "level": "ERROR",
    "message": "PaymentGatewayError: Downstream call to payment-service failed for order trc-0298",
    "trace_id": "trc-0298"
  },
  {
    "id": 106,
    "ts": "2026-10-30T14:24:43Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0309"
  },
  {
    "id": 102,
    "ts": "2026-10-30T14:24:45Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0302"
  },
  {
    "id": 138,
    "ts": "2026-10-30T14:25:08Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0375"
  },
  {
    "id": 104,
    "ts": "2026-10-30T14:25:17Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0307"
  },
  {
    "id": 63,
    "ts": "2026-10-30T14:25:30Z",
    "service_id": "payment-service",
    "level": "ERROR",
    "message": "PoolTimeoutError: timed out after 5000ms waiting for connection (pool=10/10)",
    "trace_id": "trc-0236"
  },
  {
    "id": 64,
    "ts": "2026-10-30T14:25:30Z",
    "service_id": "checkout-api",
    "level": "ERROR",
    "message": "PaymentGatewayError: Downstream call to payment-service failed for order trc-0236",
    "trace_id": "trc-0236"
  },
  {
    "id": 155,
    "ts": "2026-10-30T14:25:58Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0399"
  },
  {
    "id": 66,
    "ts": "2026-10-30T14:26:37Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0240"
  },
  {
    "id": 137,
    "ts": "2026-10-30T14:27:08Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0374"
  },
  {
    "id": 148,
    "ts": "2026-10-30T14:27:13Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0387"
  },
  {
    "id": 123,
    "ts": "2026-10-30T14:27:26Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0346"
  },
  {
    "id": 92,
    "ts": "2026-10-30T14:27:36Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0283"
  },
  {
    "id": 135,
    "ts": "2026-10-30T14:27:51Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0370"
  },
  {
    "id": 125,
    "ts": "2026-10-30T14:29:35Z",
    "service_id": "payment-service",
    "level": "ERROR",
    "message": "PoolTimeoutError: timed out after 5000ms waiting for connection (pool=10/10)",
    "trace_id": "trc-0349"
  },
  {
    "id": 126,
    "ts": "2026-10-30T14:29:35Z",
    "service_id": "checkout-api",
    "level": "ERROR",
    "message": "PaymentGatewayError: Downstream call to payment-service failed for order trc-0349",
    "trace_id": "trc-0349"
  },
  {
    "id": 79,
    "ts": "2026-10-30T14:30:45Z",
    "service_id": "payment-service",
    "level": "ERROR",
    "message": "PoolTimeoutError: timed out after 5000ms waiting for connection (pool=10/10)",
    "trace_id": "trc-0267"
  },
  {
    "id": 80,
    "ts": "2026-10-30T14:30:45Z",
    "service_id": "checkout-api",
    "level": "ERROR",
    "message": "PaymentGatewayError: Downstream call to payment-service failed for order trc-0267",
    "trace_id": "trc-0267"
  },
  {
    "id": 76,
    "ts": "2026-10-30T14:31:03Z",
    "service_id": "payment-service",
    "level": "ERROR",
    "message": "PoolTimeoutError: timed out after 5000ms waiting for connection (pool=10/10)",
    "trace_id": "trc-0265"
  },
  {
    "id": 77,
    "ts": "2026-10-30T14:31:03Z",
    "service_id": "checkout-api",
    "level": "ERROR",
    "message": "PaymentGatewayError: Downstream call to payment-service failed for order trc-0265",
    "trace_id": "trc-0265"
  },
  {
    "id": 78,
    "ts": "2026-10-30T14:31:03Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0265"
  },
  {
    "id": 89,
    "ts": "2026-10-30T14:31:19Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0278"
  },
  {
    "id": 94,
    "ts": "2026-10-30T14:31:33Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0289"
  },
  {
    "id": 69,
    "ts": "2026-10-30T14:32:32Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0254"
  },
  {
    "id": 133,
    "ts": "2026-10-30T14:32:55Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0362"
  },
  {
    "id": 90,
    "ts": "2026-10-30T14:33:12Z",
    "service_id": "payment-service",
    "level": "ERROR",
    "message": "PoolTimeoutError: timed out after 5000ms waiting for connection (pool=10/10)",
    "trace_id": "trc-0280"
  },
  {
    "id": 91,
    "ts": "2026-10-30T14:33:12Z",
    "service_id": "checkout-api",
    "level": "ERROR",
    "message": "PaymentGatewayError: Downstream call to payment-service failed for order trc-0280",
    "trace_id": "trc-0280"
  },
  {
    "id": 111,
    "ts": "2026-10-30T14:34:22Z",
    "service_id": "payment-service",
    "level": "ERROR",
    "message": "PoolTimeoutError: timed out after 5000ms waiting for connection (pool=10/10)",
    "trace_id": "trc-0319"
  },
  {
    "id": 112,
    "ts": "2026-10-30T14:34:22Z",
    "service_id": "checkout-api",
    "level": "ERROR",
    "message": "PaymentGatewayError: Downstream call to payment-service failed for order trc-0319",
    "trace_id": "trc-0319"
  },
  {
    "id": 68,
    "ts": "2026-10-30T14:34:49Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0242"
  },
  {
    "id": 113,
    "ts": "2026-10-30T14:34:53Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0323"
  },
  {
    "id": 129,
    "ts": "2026-10-30T14:35:06Z",
    "service_id": "payment-service",
    "level": "ERROR",
    "message": "PoolTimeoutError: timed out after 5000ms waiting for connection (pool=10/10)",
    "trace_id": "trc-0360"
  },
  {
    "id": 130,
    "ts": "2026-10-30T14:35:06Z",
    "service_id": "checkout-api",
    "level": "ERROR",
    "message": "PaymentGatewayError: Downstream call to payment-service failed for order trc-0360",
    "trace_id": "trc-0360"
  },
  {
    "id": 143,
    "ts": "2026-10-30T14:35:29Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0382"
  },
  {
    "id": 115,
    "ts": "2026-10-30T14:35:59Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0330"
  },
  {
    "id": 81,
    "ts": "2026-10-30T14:36:01Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0269"
  },
  {
    "id": 119,
    "ts": "2026-10-30T14:36:19Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0335"
  },
  {
    "id": 65,
    "ts": "2026-10-30T14:37:17Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0239"
  },
  {
    "id": 46,
    "ts": "2026-10-30T14:37:36Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0200"
  },
  {
    "id": 149,
    "ts": "2026-10-30T14:38:33Z",
    "service_id": "payment-service",
    "level": "ERROR",
    "message": "PoolTimeoutError: timed out after 5000ms waiting for connection (pool=10/10)",
    "trace_id": "trc-0389"
  },
  {
    "id": 150,
    "ts": "2026-10-30T14:38:33Z",
    "service_id": "checkout-api",
    "level": "ERROR",
    "message": "PaymentGatewayError: Downstream call to payment-service failed for order trc-0389",
    "trace_id": "trc-0389"
  },
  {
    "id": 61,
    "ts": "2026-10-30T14:38:59Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0234"
  },
  {
    "id": 70,
    "ts": "2026-10-30T14:39:44Z",
    "service_id": "checkout-api",
    "level": "WARN",
    "message": "tax-calculation fallback used: geographic cache miss for postal region",
    "trace_id": "trc-0255"
  },
  {
    "id": 83,
    "ts": "2026-10-30T14:39:55Z",
    "service_id": "payment-service",
    "level": "ERROR",
    "message": "PoolTimeoutError: timed out after 5000ms waiting for connection (pool=10/10)",
    "trace_id": "trc-0271"
  },
  {
    "id": 84,
    "ts": "2026-10-30T14:39:55Z",
    "service_id": "checkout-api",
    "level": "ERROR",
    "message": "PaymentGatewayError: Downstream call to payment-service failed for order trc-0271",
    "trace_id": "trc-0271"
  }
]
`

## 5. Complete Normal Logs Sample
`json
[
  {
    "id": 5,
    "ts": "2026-10-30T13:01:10Z",
    "service_id": "checkout-api",
    "level": "INFO",
    "message": "Order processed successfully: trace_id=trc-0030",
    "trace_id": "trc-0030"
  },
  {
    "id": 3,
    "ts": "2026-10-30T13:01:17Z",
    "service_id": "checkout-api",
    "level": "INFO",
    "message": "Order processed successfully: trace_id=trc-0014",
    "trace_id": "trc-0014"
  },
  {
    "id": 308,
    "ts": "2026-10-30T13:02:27Z",
    "service_id": "api-gateway",
    "level": "INFO",
    "message": "HTTP 200 POST /api/checkout/cart request completed",
    "trace_id": null
  },
  {
    "id": 309,
    "ts": "2026-10-30T13:02:27Z",
    "service_id": "payment-service",
    "level": "INFO",
    "message": "Transaction token validated against cache",
    "trace_id": null
  },
  {
    "id": 416,
    "ts": "2026-10-30T13:02:39Z",
    "service_id": "api-gateway",
    "level": "INFO",
    "message": "HTTP 200 POST /api/checkout/cart request completed",
    "trace_id": null
  },
  {
    "id": 417,
    "ts": "2026-10-30T13:02:39Z",
    "service_id": "payment-service",
    "level": "INFO",
    "message": "Transaction token validated against cache",
    "trace_id": null
  },
  {
    "id": 454,
    "ts": "2026-10-30T13:03:18Z",
    "service_id": "api-gateway",
    "level": "INFO",
    "message": "HTTP 200 POST /api/checkout/cart request completed",
    "trace_id": null
  },
  {
    "id": 455,
    "ts": "2026-10-30T13:03:18Z",
    "service_id": "payment-service",
    "level": "INFO",
    "message": "Transaction token validated against cache",
    "trace_id": null
  },
  {
    "id": 33,
    "ts": "2026-10-30T13:03:33Z",
    "service_id": "checkout-api",
    "level": "INFO",
    "message": "Order processed successfully: trace_id=trc-0132",
    "trace_id": "trc-0132"
  },
  {
    "id": 360,
    "ts": "2026-10-30T13:03:58Z",
    "service_id": "api-gateway",
    "level": "INFO",
    "message": "HTTP 200 POST /api/checkout/cart request completed",
    "trace_id": null
  },
  {
    "id": 361,
    "ts": "2026-10-30T13:03:58Z",
    "service_id": "payment-service",
    "level": "INFO",
    "message": "Transaction token validated against cache",
    "trace_id": null
  },
  {
    "id": 328,
    "ts": "2026-10-30T13:03:59Z",
    "service_id": "api-gateway",
    "level": "INFO",
    "message": "HTTP 200 POST /api/checkout/cart request completed",
    "trace_id": null
  },
  {
    "id": 329,
    "ts": "2026-10-30T13:03:59Z",
    "service_id": "payment-service",
    "level": "INFO",
    "message": "Transaction token validated against cache",
    "trace_id": null
  },
  {
    "id": 284,
    "ts": "2026-10-30T13:04:55Z",
    "service_id": "api-gateway",
    "level": "INFO",
    "message": "HTTP 200 POST /api/checkout/cart request completed",
    "trace_id": null
  },
  {
    "id": 285,
    "ts": "2026-10-30T13:04:55Z",
    "service_id": "payment-service",
    "level": "INFO",
    "message": "Transaction token validated against cache",
    "trace_id": null
  },
  {
    "id": 202,
    "ts": "2026-10-30T13:05:15Z",
    "service_id": "api-gateway",
    "level": "INFO",
    "message": "HTTP 200 POST /api/checkout/cart request completed",
    "trace_id": null
  },
  {
    "id": 203,
    "ts": "2026-10-30T13:05:15Z",
    "service_id": "payment-service",
    "level": "INFO",
    "message": "Transaction token validated against cache",
    "trace_id": null
  },
  {
    "id": 184,
    "ts": "2026-10-30T13:06:05Z",
    "service_id": "api-gateway",
    "level": "INFO",
    "message": "HTTP 200 POST /api/checkout/cart request completed",
    "trace_id": null
  },
  {
    "id": 185,
    "ts": "2026-10-30T13:06:05Z",
    "service_id": "payment-service",
    "level": "INFO",
    "message": "Transaction token validated against cache",
    "trace_id": null
  },
  {
    "id": 316,
    "ts": "2026-10-30T13:06:31Z",
    "service_id": "api-gateway",
    "level": "INFO",
    "message": "HTTP 200 POST /api/checkout/cart request completed",
    "trace_id": null
  },
  {
    "id": 317,
    "ts": "2026-10-30T13:06:31Z",
    "service_id": "payment-service",
    "level": "INFO",
    "message": "Transaction token validated against cache",
    "trace_id": null
  },
  {
    "id": 344,
    "ts": "2026-10-30T13:06:36Z",
    "service_id": "api-gateway",
    "level": "INFO",
    "message": "HTTP 200 POST /api/checkout/cart request completed",
    "trace_id": null
  },
  {
    "id": 345,
    "ts": "2026-10-30T13:06:36Z",
    "service_id": "payment-service",
    "level": "INFO",
    "message": "Transaction token validated against cache",
    "trace_id": null
  },
  {
    "id": 442,
    "ts": "2026-10-30T13:07:04Z",
    "service_id": "api-gateway",
    "level": "INFO",
    "message": "HTTP 200 POST /api/checkout/cart request completed",
    "trace_id": null
  },
  {
    "id": 443,
    "ts": "2026-10-30T13:07:04Z",
    "service_id": "payment-service",
    "level": "INFO",
    "message": "Transaction token validated against cache",
    "trace_id": null
  },
  {
    "id": 310,
    "ts": "2026-10-30T13:07:29Z",
    "service_id": "api-gateway",
    "level": "INFO",
    "message": "HTTP 200 POST /api/checkout/cart request completed",
    "trace_id": null
  },
  {
    "id": 311,
    "ts": "2026-10-30T13:07:29Z",
    "service_id": "payment-service",
    "level": "INFO",
    "message": "Transaction token validated against cache",
    "trace_id": null
  },
  {
    "id": 368,
    "ts": "2026-10-30T13:07:41Z",
    "service_id": "api-gateway",
    "level": "INFO",
    "message": "HTTP 200 POST /api/checkout/cart request completed",
    "trace_id": null
  },
  {
    "id": 369,
    "ts": "2026-10-30T13:07:41Z",
    "service_id": "payment-service",
    "level": "INFO",
    "message": "Transaction token validated against cache",
    "trace_id": null
  },
  {
    "id": 330,
    "ts": "2026-10-30T13:09:42Z",
    "service_id": "api-gateway",
    "level": "INFO",
    "message": "HTTP 200 POST /api/checkout/cart request completed",
    "trace_id": null
  }
]
`
