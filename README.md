# 🌾 AgriGuard: Blockchain-Powered Supply Chain Insurance

Welcome to AgriGuard, a revolutionary Web3 solution that automates insurance for farmers against contaminated harvests! Using the Stacks blockchain and Clarity smart contracts, this project detects contamination early via oracles (e.g., IoT sensors reporting data) and triggers instant, transparent compensations—eliminating slow insurance bureaucracies and reducing financial losses in agriculture supply chains.

## ✨ Features

🌱 Register farmers and their harvests with verifiable data  
🔍 Integrate oracles for real-time contamination detection (e.g., toxins, pests)  
💰 Automated premium payments and policy management  
⚡ Instant payouts upon early detection, no manual claims needed  
📊 Transparent tracking of supply chain events on the blockchain  
🛡️ Secure fund pools for insurance reserves  
🔒 Dispute resolution for rare contested claims  
📈 Analytics for insurers to assess risk and adjust policies  

## 🛠 How It Works

AgriGuard leverages 8 Clarity smart contracts to create a decentralized, trustless system. Farmers buy policies, oracles report harvest health, and contracts handle everything automatically—solving real-world issues like delayed payouts and fraud in agricultural insurance.

### Smart Contracts Overview
1. **FarmerRegistry**: Registers farmers with their wallet addresses and basic info (e.g., farm location, crop type). Prevents duplicates and verifies eligibility.  
2. **PolicyManager**: Creates and manages insurance policies, including terms like coverage amount, premium rates, and contamination thresholds.  
3. **PremiumCollector**: Handles premium payments from farmers, escrows funds into a pool, and issues policy NFTs as proof.  
4. **OracleConnector**: Integrates external oracles to submit contamination data (e.g., sensor readings hashed on-chain for immutability).  
5. **ContaminationVerifier**: Analyzes oracle data against policy thresholds to detect issues early and trigger alerts.  
6. **ClaimAutomator**: Automatically validates detections and initiates payouts if criteria are met, reducing human intervention.  
7. **PayoutDistributor**: Distributes compensation from the insurance pool to farmers' wallets, logging all transactions transparently.  
8. **DisputeResolver**: Allows stakeholders to challenge detections (e.g., via multi-sig voting) and handles refunds or adjustments if needed.

**For Farmers**  
- Register your farm via FarmerRegistry.  
- Purchase a policy through PolicyManager by paying premiums to PremiumCollector.  
- Monitor your harvest—oracle data feeds into OracleConnector.  
- If contamination is detected early (e.g., via sensors), ContaminationVerifier and ClaimAutomator trigger an automatic payout from PayoutDistributor. No paperwork!  

**For Insurers**  
- Fund the insurance pool via PremiumCollector.  
- Set policy terms in PolicyManager and monitor risks using on-chain analytics.  
- In disputes, use DisputeResolver to review and vote on claims.  

**For Oracles (e.g., IoT Providers)**  
- Submit verified data (e.g., contamination levels) to OracleConnector.  
- Earn rewards for accurate reporting, enforced by ContaminationVerifier.  

That's it! AgriGuard ensures fair, fast compensation, empowering small farmers and making supply chains resilient. Deploy on Stacks for low-cost, secure execution.