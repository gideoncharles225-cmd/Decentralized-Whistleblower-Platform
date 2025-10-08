(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-HASH u101)
(define-constant ERR-INVALID-TITLE u102)
(define-constant ERR-INVALID-DESC u103)
(define-constant ERR-REPORT-ALREADY-EXISTS u104)
(define-constant ERR-REPORT-NOT-FOUND u105)
(define-constant ERR-INVALID-TIMESTAMP u106)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u107)
(define-constant ERR-INVALID-STAKE u108)
(define-constant ERR-MAX-REPORTS-EXCEEDED u109)
(define-constant ERR-INVALID-STATUS u110)

(define-data-var report-counter uint u0)
(define-data-var max-reports uint u10000)
(define-data-var submission-fee uint u500)
(define-data-var authority-contract (optional principal) none)

(define-map reports
  { report-id: uint }
  {
    report-hash: (buff 32),
    title: (string-utf8 100),
    description: (string-utf8 500),
    timestamp: uint,
    submitter: principal,
    status: (string-utf8 20),
    stake-amount: uint
  }
)

(define-map reports-by-hash
  { report-hash: (buff 32) }
  uint
)

(define-map report-updates
  { report-id: uint }
  {
    update-title: (string-utf8 100),
    update-description: (string-utf8 500),
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-report (id uint))
  (map-get? reports { report-id: id })
)

(define-read-only (get-report-updates (id uint))
  (map-get? report-updates { report-id: id })
)

(define-read-only (is-report-registered (hash (buff 32)))
  (is-some (map-get? reports-by-hash { report-hash: hash }))
)

(define-private (validate-hash (hash (buff 32)))
  (if (> (len hash) u0)
      (ok true)
      (err ERR-INVALID-HASH))
)

(define-private (validate-title (title (string-utf8 100)))
  (if (and (> (len title) u0) (<= (len title) u100))
      (ok true)
      (err ERR-INVALID-TITLE))
)

(define-private (validate-description (desc (string-utf8 500)))
  (if (and (> (len desc) u0) (<= (len desc) u500))
      (ok true)
      (err ERR-INVALID-DESC))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-stake (amount uint))
  (if (>= amount u0)
      (ok true)
      (err ERR-INVALID-STAKE))
)

(define-private (validate-status (status (string-utf8 20)))
  (if (or (is-eq status "pending") (is-eq status "verified") (is-eq status "rejected"))
      (ok true)
      (err ERR-INVALID-STATUS))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-submission-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-STAKE))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set submission-fee new-fee)
    (ok true)
  )
)

(define-public (set-max-reports (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-MAX-REPORTS-EXCEEDED))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-reports new-max)
    (ok true)
  )
)

(define-public (submit-report
  (report-hash (buff 32))
  (title (string-utf8 100))
  (description (string-utf8 500))
  (stake-amount uint)
)
  (let (
        (report-id (var-get report-counter))
        (current-max (var-get max-reports))
        (authority (var-get authority-contract))
      )
    (asserts! (< report-id current-max) (err ERR-MAX-REPORTS-EXCEEDED))
    (try! (validate-hash report-hash))
    (try! (validate-title title))
    (try! (validate-description description))
    (try! (validate-stake stake-amount))
    (asserts! (is-none (map-get? reports-by-hash { report-hash: report-hash })) (err ERR-REPORT-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get submission-fee) tx-sender authority-recipient))
    )
    (map-set reports { report-id: report-id }
      {
        report-hash: report-hash,
        title: title,
        description: description,
        timestamp: block-height,
        submitter: tx-sender,
        status: "pending",
        stake-amount: stake-amount
      }
    )
    (map-set reports-by-hash { report-hash: report-hash } report-id)
    (var-set report-counter (+ report-id u1))
    (print { event: "report-submitted", id: report-id })
    (ok report-id)
  )
)

(define-public (update-report
  (report-id uint)
  (update-title (string-utf8 100))
  (update-description (string-utf8 500))
)
  (let ((report (map-get? reports { report-id: report-id })))
    (match report
      r
        (begin
          (asserts! (is-eq (get submitter r) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-title update-title))
          (try! (validate-description update-description))
          (map-set reports { report-id: report-id }
            {
              report-hash: (get report-hash r),
              title: update-title,
              description: update-description,
              timestamp: block-height,
              submitter: (get submitter r),
              status: (get status r),
              stake-amount: (get stake-amount r)
            }
          )
          (map-set report-updates { report-id: report-id }
            {
              update-title: update-title,
              update-description: update-description,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "report-updated", id: report-id })
          (ok true)
        )
      (err ERR-REPORT-NOT-FOUND)
    )
  )
)

(define-public (update-report-status
  (report-id uint)
  (new-status (string-utf8 20))
)
  (let ((report (map-get? reports { report-id: report-id })))
    (match report
      r
        (begin
          (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
          (try! (validate-status new-status))
          (map-set reports { report-id: report-id }
            {
              report-hash: (get report-hash r),
              title: (get title r),
              description: (get description r),
              timestamp: block-height,
              submitter: (get submitter r),
              status: new-status,
              stake-amount: (get stake-amount r)
            }
          )
          (print { event: "status-updated", id: report-id, status: new-status })
          (ok true)
        )
      (err ERR-REPORT-NOT-FOUND)
    )
  )
)

(define-public (get-report-count)
  (ok (var-get report-counter))
)