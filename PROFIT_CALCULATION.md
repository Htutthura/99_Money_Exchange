# Profit Calculation in 99Money Exchange App

## Overview

The profit calculation feature in 99Money Exchange App matches BUY and SELL transactions to calculate profits based on exchange rate differences. This document explains how the calculation works and how to use it.

## How Profit Is Calculated

1. **Transaction Matching**:
   - SELL transactions are matched with BUY transactions in chronological order
   - For each match, the profit is calculated as the difference between buy rate and sell rate
   - Partial matches are supported - a large BUY transaction can be matched with multiple smaller SELL transactions

2. **Formula**:
   For a matched amount of MMK:
   ```
   buy_thb_equivalent = matched_mmk / buy_rate
   sell_thb_actual = matched_mmk / sell_rate
   profit = sell_thb_actual - buy_thb_equivalent
   ```

3. **Results**:
   - Each SELL transaction stores its individual profit
   - Unmatched amounts (from both BUY and SELL) are tracked for future matching
   - Total profit is the sum of all individual profits

## Using the Profit Calculation Feature

### Frontend

1. Click the "Calculate Profit" button in the Transaction table view
2. A dialog will appear showing:
   - Total profit across all matched transactions
   - Detailed breakdown of each matched pair with individual profit
   - List of unmatched BUY and SELL transactions

### API Endpoint

The profit calculation is available through:
```
GET /api/transactions/calculate_profits/
```

Response format:
```json
{
  "total_profit": 1546.42,
  "transaction_count": 6,
  "profit_details": [
    {
      "buy_id": 2,
      "buy_customer": "Customer A",
      "sell_id": 4,
      "sell_customer": "Customer B",
      "matched_mmk": 36000.0,
      "buy_rate": 133.87,
      "sell_rate": 36.0,
      "profit": 731.08
    },
    ...
  ],
  "unmatched_transactions": {
    "buy": [
      {
        "id": 5,
        "customer": "Customer C",
        "date_time": "2025-05-08T11:39:26.167570Z",
        "mmk_amount": 72000.0,
        "thb_amount": 2000.0,
        "rate": 36.0
      },
      ...
    ],
    "sell": [
      ...
    ]
  }
}
```

## Implementation Details

1. **Backend**:
   - `calculate_profits` function in `transactions/views.py` matches transactions and calculates profit
   - Profit is stored in the `profit` field of the Transaction model
   - The algorithm maximizes profit by matching transactions in chronological order

2. **Frontend**:
   - TransactionTable component includes a Calculate Profit button
   - ProfitDialog displays the calculation results in a user-friendly format
   - Unmatched transactions are clearly highlighted

## Testing

A test script is provided to verify profit calculations:
```
python test_profit_calculation.py
```

## Best Practices

1. **When to Calculate Profit**:
   - Calculate profit regularly to track business performance
   - Calculate after adding multiple transactions for a more comprehensive view

2. **Understanding Results**:
   - Positive profit values indicate successful trading
   - Large unmatched amounts may indicate inventory imbalance

3. **Optimizing Profit**:
   - Compare buy/sell rates over time to identify optimal trading windows
   - Monitor which customer transactions generate the most profit 