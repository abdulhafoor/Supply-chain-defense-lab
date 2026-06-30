# Supply Chain Defense Lab

A containerized cybersecurity lab simulating supply chain attacks and defenses.  
This project demonstrates how tampered packages can be detected and visualized in real time.

## 🧪 Lab Components
- **Attacker**: injects tampered packages into the environment
- **Victim**: consumes packages (benign or tampered)
- **Monitor**: Node.js service that detects anomalies and sends alerts
- **Frontend**: React dashboard (see [supply-chain-dashboard](https://github.com/abdulhafoor/Supply-chain-dashboard))

## ✨ Features
- Real-time monitoring of package events
- Severity classification (INFO, WARNING, CRITICAL)
- Alerts streamed to dashboard
- Dockerized attacker/victim/monitor setup

## ⚙️ Setup
Clone the repo and run:
```bash
docker compose up --build
