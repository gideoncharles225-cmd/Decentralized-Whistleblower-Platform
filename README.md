# 🕵️‍♂️ Decentralized Whistleblower Platform

Welcome to a secure, transparent, and rewarding way to report misconduct using the Stacks blockchain! This Web3 project empowers whistleblowers to submit encrypted reports of corruption or misconduct anonymously, verify their authenticity, and earn token rewards while maintaining privacy.

## ✨ Features

🔒 **Anonymous Submission**: Submit encrypted reports without revealing identity.  
✅ **Verification Process**: Validators review and verify reports for authenticity.  
💰 **Token Rewards**: Whistleblowers earn tokens for verified reports.  
📜 **Immutable Records**: Store report metadata on the Stacks blockchain for transparency.  
🚫 **Anti-Abuse Mechanisms**: Prevent spam or false reports.  
🔐 **Encrypted Storage**: Store sensitive data off-chain with hash-based verification on-chain.  
👥 **Governance System**: Community voting for validator selection and reward distribution.

## 🛠 How It Works

### For Whistleblowers
1. Encrypt your report off-chain (e.g., using AES-256).
2. Generate a SHA-256 hash of the encrypted report.
3. Submit the hash, a title, and a brief description via the `submit-report` function.
4. Optionally, stake tokens to signal report credibility (returned if verified).
5. Await validator review and earn tokens if the report is verified.

### For Validators
1. Access report metadata using `get-report-details`.
2. Verify the report's authenticity off-chain using the provided hash.
3. Submit verification results via `verify-report`.
4. Earn a portion of the reward pool for accurate validations.

### For Governance
1. Community members stake tokens to vote for trusted validators.
2. Validators with the highest votes are selected for a fixed term.
3. Reward pools are distributed based on governance decisions.

## 📑 Smart Contracts

The platform uses **8 Clarity smart contracts** to manage the whistleblower ecosystem:

1. **ReportRegistry**: Stores report hashes, titles, descriptions, and submission metadata.
2. **TokenReward**: Manages the platform's native token for rewarding whistleblowers and validators.
3. **ValidatorRegistry**: Tracks registered validators and their reputation scores.
4. **VerificationManager**: Handles the verification process and validator assignments.
5. **Governance**: Enables community voting for validator selection and reward policies.
6. **StakeManager**: Manages token staking for whistleblowers and governance participants.
7. **AntiAbuse**: Implements mechanisms to flag and penalize spam or malicious reports.
8. **RewardPool**: Distributes tokens to whistleblowers and validators based on verification outcomes.

### Example Workflow
- A whistleblower submits a report hash to `ReportRegistry` with a title and description.
- `StakeManager` locks their optional stake to prevent spam.
- `VerificationManager` assigns the report to validators from `ValidatorRegistry`.
- Validators verify the report off-chain and submit results to `VerificationManager`.
- If verified, `TokenReward` and `RewardPool` distribute tokens to the whistleblower and validators.
- `Governance` allows the community to vote on validator performance and reward rates.
- `AntiAbuse` monitors for duplicate or malicious submissions.

## 🚀 Getting Started

### Prerequisites
- Stacks blockchain account with STX tokens.
- Clarity development environment (e.g., Clarinet).
- Node.js for off-chain encryption and interaction.

## 🛡️ Security Considerations
- **Anonymity**: No identifying information is stored on-chain; only hashes are recorded.
- **Encryption**: Reports are encrypted off-chain, with hashes ensuring integrity.
- **Anti-Abuse**: Staking and reputation systems deter spam and malicious actors.
- **Transparency**: All actions (submissions, verifications, rewards) are logged immutably.

## 📜 License
MIT License. See `LICENSE` for details.
