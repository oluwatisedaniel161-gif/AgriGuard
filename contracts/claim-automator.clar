;; claim-automator.clar
;; Core contract for automating insurance claims in AgriGuard
;; Handles validation of contamination data, policy checks, and payout triggering
;; Integrates with PolicyManager, ContaminationVerifier, OracleConnector, and PayoutDistributor

;; Constants
(define-constant ERR_POLICY_NOT_ACTIVE u100)
(define-constant ERR_PREMIUMS_UNPAID u101)
(define-constant ERR_INVALID_CONTAMINATION_DATA u102)
(define-constant ERR_BELOW_THRESHOLD u103)
(define-constant ERR_CLAIM_ALREADY_PROCESSED u104)
(define-constant ERR_UNAUTHORIZED u105)
(define-constant ERR_PAUSED u106)
(define-constant ERR_INVALID_FARMER u107)
(define-constant ERR_NO_FUNDS_AVAILABLE u108)
(define-constant ERR_DISPUTE_IN_PROGRESS u109)
(define-constant ERR_INVALID_TIMESTAMP u110)
(define-constant ERR_METADATA_TOO_LONG u111)
(define-constant ERR_INVALID_THRESHOLD u112)
(define-constant MAX_METADATA_LEN u1000)
(define-constant CLAIM_WINDOW_BLOCKS u144) ;; ~1 day in Stacks blocks
(define-constant ADMIN tx-sender) ;; Deployer is initial admin

;; Data Variables
(define-data-var contract-paused bool false)
(define-data-var admin principal tx-sender)
(define-data-var total-claims-processed uint u0)
(define-data-var total-payouts uint u0)
(define-data-var min-threshold uint u10) ;; Minimum contamination level for claim (configurable)

;; Data Maps
(define-map claims
  { policy-id: uint, farmer: principal }
  {
    status: (string-ascii 20), ;; "pending", "verified", "paid", "rejected", "disputed"
    contamination-level: uint,
    timestamp: uint,
    payout-amount: uint,
    oracle-data-hash: (buff 32),
    metadata: (string-utf8 500),
    dispute-end-block: (optional uint)
  }
)

(define-map policy-thresholds
  { policy-id: uint }
  {
    min-contamination: uint,
    max-contamination: uint,
    crop-type: (string-ascii 50),
    coverage-amount: uint
  }
)

(define-map claim-history
  { claim-id: uint }
  {
    policy-id: uint,
    farmer: principal,
    outcome: (string-ascii 20),
    timestamp: uint,
    amount: uint
  }
)

(define-map disputes
  { claim-id: uint }
  {
    initiator: principal,
    reason: (string-utf8 200),
    votes-for: uint,
    votes-against: uint,
    resolved: bool,
    resolution: (optional (string-ascii 20))
  }
)

(define-map authorized-oracles principal bool)
(define-map authorized-verifiers principal bool)

;; Private Functions
(define-private (is-admin (caller principal))
  (is-eq caller (var-get admin))
)

(define-private (is-authorized-oracle (caller principal))
  (default-to false (map-get? authorized-oracles caller))
)

(define-private (is-policy-active (policy-id uint))
  ;; Mock call to PolicyManager - in real, (contract-call? .policy-manager is-active policy-id)
  (ok true) ;; For simulation
)

(define-private (are-premiums-paid (policy-id uint))
  ;; Mock call to PremiumCollector
  (ok true)
)

(define-private (get-contamination-data (policy-id uint))
  ;; Mock call to ContaminationVerifier
  (ok u15) ;; Sample level
)

(define-private (trigger-payout (farmer principal) (amount uint))
  ;; Mock call to PayoutDistributor
  (ok true)
)

(define-private (log-claim-history (claim-id uint) (policy-id uint) (farmer principal) (outcome (string-ascii 20)) (amount uint))
  (map-set claim-history
    { claim-id: claim-id }
    {
      policy-id: policy-id,
      farmer: farmer,
      outcome: outcome,
      timestamp: block-height,
      amount: amount
    }
  )
)

;; Public Functions
(define-public (pause-contract)
  (begin
    (asserts! (is-admin tx-sender) (err ERR_UNAUTHORIZED))
    (var-set contract-paused true)
    (ok true)
  )
)

(define-public (unpause-contract)
  (begin
    (asserts! (is-admin tx-sender) (err ERR_UNAUTHORIZED))
    (var-set contract-paused false)
    (ok true)
  )
)

(define-public (set-admin (new-admin principal))
  (begin
    (asserts! (is-admin tx-sender) (err ERR_UNAUTHORIZED))
    (var-set admin new-admin)
    (ok true)
  )
)

(define-public (add-authorized-oracle (oracle principal))
  (begin
    (asserts! (is-admin tx-sender) (err ERR_UNAUTHORIZED))
    (map-set authorized-oracles oracle true)
    (ok true)
  )
)

(define-public (remove-authorized-oracle (oracle principal))
  (begin
    (asserts! (is-admin tx-sender) (err ERR_UNAUTHORIZED))
    (map-delete authorized-oracles oracle)
    (ok true)
  )
)

(define-public (set-min-threshold (new-threshold uint))
  (begin
    (asserts! (is-admin tx-sender) (err ERR_UNAUTHORIZED))
    (asserts! (> new-threshold u0) (err ERR_INVALID_THRESHOLD))
    (var-set min-threshold new-threshold)
    (ok true)
  )
)

(define-public (register-policy-threshold (policy-id uint) (min-cont uint) (max-cont uint) (crop (string-ascii 50)) (coverage uint))
  (begin
    (asserts! (is-admin tx-sender) (err ERR_UNAUTHORIZED))
    (asserts! (<= min-cont max-cont) (err ERR_INVALID_THRESHOLD))
    (map-set policy-thresholds
      { policy-id: policy-id }
      {
        min-contamination: min-cont,
        max-contamination: max-cont,
        crop-type: crop,
        coverage-amount: coverage
      }
    )
    (ok true)
  )
)

(define-public (submit-contamination-data (policy-id uint) (farmer principal) (level uint) (data-hash (buff 32)) (metadata (string-utf8 500)))
  (begin
    (asserts! (not (var-get contract-paused)) (err ERR_PAUSED))
    (asserts! (is-authorized-oracle tx-sender) (err ERR_UNAUTHORIZED))
    (asserts! (<= (len metadata) MAX_METADATA_LEN) (err ERR_METADATA_TOO_LONG))
    (match (is-policy-active policy-id)
      success (asserts! success (err ERR_POLICY_NOT_ACTIVE))
      error (err ERR_POLICY_NOT_ACTIVE)
    )
    (match (are-premiums-paid policy-id)
      success (asserts! success (err ERR_PREMIUMS_UNPAID))
      error (err ERR_PREMIUMS_UNPAID)
    )
    (let
      (
        (thresholds (unwrap! (map-get? policy-thresholds {policy-id: policy-id}) (err ERR_INVALID_CONTAMINATION_DATA)))
        (claim-key {policy-id: policy-id, farmer: farmer})
        (existing-claim (map-get? claims claim-key))
      )
      (asserts! (is-none existing-claim) (err ERR_CLAIM_ALREADY_PROCESSED))
      (asserts! (>= level (get min-contamination thresholds)) (err ERR_BELOW_THRESHOLD))
      (asserts! (<= level (get max-contamination thresholds)) (err ERR_INVALID_CONTAMINATION_DATA))
      (map-set claims
        claim-key
        {
          status: "pending",
          contamination-level: level,
          timestamp: block-height,
          payout-amount: (get coverage-amount thresholds),
          oracle-data-hash: data-hash,
          metadata: metadata,
          dispute-end-block: none
        }
      )
      (ok true)
    )
  )
)

(define-public (process-claim (policy-id uint) (farmer principal) (claim-id uint))
  (begin
    (asserts! (not (var-get contract-paused)) (err ERR_PAUSED))
    (let
      (
        (claim-key {policy-id: policy-id, farmer: farmer})
        (claim (unwrap! (map-get? claims claim-key) (err ERR_CLAIM_ALREADY_PROCESSED)))
      )
      (asserts! (is-eq (get status claim) "pending") (err ERR_CLAIM_ALREADY_PROCESSED))
      (asserts! (< (- block-height (get timestamp claim)) CLAIM_WINDOW_BLOCKS) (err ERR_INVALID_TIMESTAMP))
      ;; Verify contamination again
      (match (get-contamination-data policy-id)
        level (asserts! (>= level (var-get min-threshold)) (err ERR_BELOW_THRESHOLD))
        error (err ERR_INVALID_CONTAMINATION_DATA)
      )
      ;; Check for dispute
      (let ((dispute (map-get? disputes {claim-id: claim-id})))
        (if (is-some dispute)
          (let ((d (unwrap-panic dispute)))
            (asserts! (not (get resolved d)) (err ERR_DISPUTE_IN_PROGRESS))
          )
          true
        )
      )
      (map-set claims claim-key (merge claim {status: "verified"}))
      (match (trigger-payout farmer (get payout-amount claim))
        success
          (begin
            (map-set claims claim-key (merge claim {status: "paid"}))
            (var-set total-claims-processed (+ (var-get total-claims-processed) u1))
            (var-set total-payouts (+ (var-get total-payouts) (get payout-amount claim)))
            (log-claim-history claim-id policy-id farmer "paid" (get payout-amount claim))
            (ok true)
          )
        error (err ERR_NO_FUNDS_AVAILABLE)
      )
    )
  )
)

(define-public (initiate-dispute (claim-id uint) (policy-id uint) (farmer principal) (reason (string-utf8 200)))
  (begin
    (asserts! (not (var-get contract-paused)) (err ERR_PAUSED))
    (let
      (
        (claim-key {policy-id: policy-id, farmer: farmer})
        (claim (unwrap! (map-get? claims claim-key) (err ERR_CLAIM_ALREADY_PROCESSED)))
      )
      (asserts! (or (is-eq tx-sender farmer) (is-admin tx-sender)) (err ERR_UNAUTHORIZED))
      (asserts! (is-eq (get status claim) "verified") (err ERR_CLAIM_ALREADY_PROCESSED))
      (asserts! (< (- block-height (get timestamp claim)) CLAIM_WINDOW_BLOCKS) (err ERR_INVALID_TIMESTAMP))
      (map-set disputes
        {claim-id: claim-id}
        {
          initiator: tx-sender,
          reason: reason,
          votes-for: u0,
          votes-against: u0,
          resolved: false,
          resolution: none
        }
      )
      (map-set claims claim-key (merge claim {status: "disputed", dispute-end-block: (some (+ block-height CLAIM_WINDOW_BLOCKS))}))
      (ok true)
    )
  )
)

(define-public (vote-on-dispute (claim-id uint) (vote bool))
  (begin
    (asserts! (not (var-get contract-paused)) (err ERR_PAUSED))
    (let ((dispute (unwrap! (map-get? disputes {claim-id: claim-id}) (err ERR_DISPUTE_IN_PROGRESS))))
      (asserts! (not (get resolved dispute)) (err ERR_DISPUTE_IN_PROGRESS))
      (asserts! (default-to false (map-get? authorized-verifiers tx-sender)) (err ERR_UNAUTHORIZED))
      (if vote
        (map-set disputes {claim-id: claim-id} (merge dispute {votes-for: (+ (get votes-for dispute) u1)}))
        (map-set disputes {claim-id: claim-id} (merge dispute {votes-against: (+ (get votes-against dispute) u1)}))
      )
      (ok true)
    )
  )
)

(define-public (resolve-dispute (claim-id uint) (policy-id uint) (farmer principal))
  (begin
    (asserts! (is-admin tx-sender) (err ERR_UNAUTHORIZED))
    (let
      (
        (dispute (unwrap! (map-get? disputes {claim-id: claim-id}) (err ERR_DISPUTE_IN_PROGRESS)))
        (claim-key {policy-id: policy-id, farmer: farmer})
        (claim (unwrap! (map-get? claims claim-key) (err ERR_CLAIM_ALREADY_PROCESSED)))
      )
      (asserts! (>= block-height (unwrap-panic (get dispute-end-block claim))) (err ERR_DISPUTE_IN_PROGRESS))
      (let ((resolution (if (> (get votes-for dispute) (get votes-against dispute)) "upheld" "rejected")))
        (map-set disputes {claim-id: claim-id} (merge dispute {resolved: true, resolution: (some resolution)}))
        (if (is-eq resolution "rejected")
          (begin
            (map-set claims claim-key (merge claim {status: "rejected"}))
            (log-claim-history claim-id policy-id farmer "rejected" u0)
          )
          (match (trigger-payout farmer (get payout-amount claim))
            success
              (begin
                (map-set claims claim-key (merge claim {status: "paid"}))
                (var-set total-claims-processed (+ (var-get total-claims-processed) u1))
                (var-set total-payouts (+ (var-get total-payouts) (get payout-amount claim)))
                (log-claim-history claim-id policy-id farmer "paid" (get payout-amount claim))
              )
            error (err ERR_NO_FUNDS_AVAILABLE)
          )
        )
        (ok true)
      )
    )
  )
)

;; Read-Only Functions
(define-read-only (get-claim-details (policy-id uint) (farmer principal))
  (map-get? claims {policy-id: policy-id, farmer: farmer})
)

(define-read-only (get-dispute-details (claim-id uint))
  (map-get? disputes {claim-id: claim-id})
)

(define-read-only (get-total-claims)
  (var-get total-claims-processed)
)

(define-read-only (get-total-payouts)
  (var-get total-payouts)
)

(define-read-only (get-contract-paused)
  (var-get contract-paused)
)

(define-read-only (get-admin)
  (var-get admin)
)

(define-read-only (get-claim-history (claim-id uint))
  (map-get? claim-history {claim-id: claim-id})
)

(define-read-only (get-policy-threshold (policy-id uint))
  (map-get? policy-thresholds {policy-id: policy-id})
)

(define-read-only (is-oracle-authorized (oracle principal))
  (default-to false (map-get? authorized-oracles oracle))
)