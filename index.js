const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

// Import all route modules
const accountRoutes = require("./account");
const agedRoutes = require("./aged");
const billRoutes = require("./bill");
const cashFlowRoutes = require("./cash-flow");
const customerRoutes = require("./customer");
const expenseRoutes = require("./expense");
const generalLedgerRoutes = require("./general_ledger");
const inventoryRoutes = require("./inventory");
const invoiceRoutes = require("./invoice");
const journalEntryRoutes = require("./journal-entry");
const paymentRoutes = require("./payment");
const salesRoutes = require("./sales");
const transactionRoutes = require("./transaction");
const transferRoutes = require("./transfer");
const trialBalanceRoutes = require("./trial-balance");
const vendorRoutes = require("./vendor");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "OK", 
    message: "QuickBooks Data Script Service is running",
    timestamp: new Date().toISOString(),
    services: [
      "account",
      "aged",
      "bill",
      "cash-flow",
      "customer", 
      "expense",
      "general-ledger",
      "inventory",
      "invoice",
      "journal-entry",
      "payment",
      "sales",
      "transaction",
      "transfer",
      "trial-balance",
      "vendor"
    ]
  });
});

// Register all routes
app.use("/api/account", accountRoutes);
app.use("/api/aged", agedRoutes);
app.use("/api/bill", billRoutes);
app.use("/api/cash-flow", cashFlowRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/expense", expenseRoutes);
app.use("/api/general-ledger", generalLedgerRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/invoice", invoiceRoutes);
app.use("/api/journal-entry", journalEntryRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/transaction", transactionRoutes);
app.use("/api/transfer", transferRoutes);
app.use("/api/trial-balance", trialBalanceRoutes);
app.use("/api/vendor", vendorRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "QuickBooks Data Script API",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      account: "/api/account",
      aged: "/api/aged",
      bill: "/api/bill",
      cashFlow: "/api/cash-flow",
      customer: "/api/customer",
      expense: "/api/expense",
      generalLedger: "/api/general-ledger",
      inventory: "/api/inventory",
      invoice: "/api/invoice",
      journalEntry: "/api/journal-entry",
      payment: "/api/payment",
      sales: "/api/sales",
      transaction: "/api/transaction",
      transfer: "/api/transfer",
      trialBalance: "/api/trial-balance",
      vendor: "/api/vendor"
    }
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global error handler:", err);
  res.status(500).json({ 
    error: "Internal server error",
    message: err.message 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 QuickBooks Data Script Service running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API documentation: http://localhost:${PORT}/`);
});

module.exports = app;
