# Projection Engine - Conceptual Model

## Overview

The projection engine simulates your financial future month-by-month over a configurable time horizon. It combines **baseline configuration** (your starting situation and automatic growth) with **events** (manual overrides and one-time occurrences).

## Core Concept

```
Projection = Baseline + Automatic Growth + Events
```

### 1. Baseline Configuration
Your starting financial situation:
- Current salary
- Current monthly expenses
- Current savings rate
- Tax rates
- Investment account balances

### 2. Automatic Growth
Built-in growth that happens every year:
- **Salary Growth**: Your salary increases by `annual_salary_growth` each year
  - Example: $80,000 salary with 3% growth → $82,400 in year 2, $84,872 in year 3, etc.
  - Formula: `salary_year_N = starting_salary × (1 + growth_rate)^N`

- **Expense Growth**: Your expenses increase by `annual_expense_growth` (typically inflation)
  - Example: $3,000/mo expenses with 2% growth → $3,060/mo in year 2
  - Formula: `expenses_year_N = starting_expenses × (1 + growth_rate)^N`

- **Investment Returns**: Your investments compound monthly
  - Example: 7% annual return = ~0.565% monthly return
  - Formula: `balance_month_N = balance_month_(N-1) × (1 + monthly_rate) + new_contributions`

### 3. Events (Manual Overrides)
Specific occurrences that deviate from the baseline:

#### One-Time Events
Affect only the month they occur:
- **One-Time Income**: Bonus, inheritance, tax refund
- **One-Time Expense**: Car purchase, vacation, medical bill
- **Extra Debt Payment**: Lump sum towards mortgage/loan

#### State Change Events
Permanently change the baseline from that point forward:
- **Salary Change**: Promotion → new base salary for all future months
- **Expense Change**: Having kids → new base expenses for all future months
- **Savings Rate Change**: Debt paid off → new savings rate for all future months

## Month-by-Month Calculation

For each month (from month 0 to month `horizon × 12`):

### Step 1: Calculate Baseline Values (with automatic growth)
```
years_elapsed = month / 12
current_salary = base_salary × (1 + salary_growth)^years_elapsed
current_expenses = base_expenses × (1 + expense_growth)^years_elapsed
```

### Step 2: Apply Events for This Month
```
events_this_month = find_events_for_month(month)

for each event:
  if event.type == "one_time_income":
    add_to_income_this_month_only(event.amount)

  if event.type == "one_time_expense":
    add_to_expenses_this_month_only(event.amount)

  if event.type == "salary_change":
    base_salary = event.new_salary  // Affects all future months!

  if event.type == "expense_change":
    base_expenses = event.new_expenses  // Affects all future months!

  if event.type == "extra_debt_payment":
    reduce_debt_balance(event.account_id, event.amount)
```

### Step 3: Calculate This Month's Numbers
```
gross_monthly_income = current_salary / 12
monthly_income_after_tax = gross_monthly_income × (1 - effective_tax_rate)
total_income = monthly_income_after_tax + one_time_income_this_month

total_expenses = current_expenses + one_time_expenses_this_month

net_cash_flow = total_income - total_expenses
savings = net_cash_flow × savings_rate
```

### Step 4: Update Account Balances
```
for each investment_account:
  monthly_return = account.annual_return / 12
  account.balance = account.balance × (1 + monthly_return) + allocated_savings

for each debt_account:
  calculate_interest_and_principal()
  apply_monthly_payment()
```

### Step 5: Record Data Point
```
record(
  month: current_month,
  net_worth: total_assets - total_liabilities,
  assets: total_assets,
  liabilities: total_liabilities,
  cash_flow: net_cash_flow
)
```

### Step 6: Move to Next Month
The modified state (if events changed salary/expenses/savings rate) carries forward.

## Example Scenario

**Baseline Configuration:**
- Salary: $80,000 with 3% annual growth
- Expenses: $3,000/month with 2% annual growth
- Savings Rate: 20%

**Events:**
1. **Month 12 (Jan 2027)**: One-time expense of $30,000 (buy car)
2. **Month 24 (Jan 2028)**: Salary change to $120,000 (promotion)
3. **Month 36 (Jan 2029)**: Expense change to $4,000/month (having twins)
4. **Month 48 (Jan 2030)**: Savings rate change to 35% (debt paid off)

**What Happens:**

- **Months 0-11**:
  - Salary grows automatically: $80k → $82.4k
  - Expenses grow: $3,000 → $3,060/mo

- **Month 12**:
  - Extra $30,000 expense (car)
  - Salary continues automatic growth

- **Months 13-23**:
  - Salary continues growing from $82.4k base
  - Expenses continue growing from $3,060 base

- **Month 24**:
  - Salary JUMPS to $120,000 (new baseline!)
  - Automatic 3% growth now applies to $120k going forward

- **Months 25-35**:
  - Salary grows from $120k base
  - Expenses continue from their growth path

- **Month 36**:
  - Expenses JUMP to $4,000/month (new baseline!)
  - Automatic 2% growth now applies to $4k going forward

- **Month 48**:
  - Savings rate changes to 35%
  - More money goes to investments each month

## Key Insights

1. **Automatic Growth Never Stops**: Even when you add events, the growth rates continue to apply. If you get a promotion that sets your salary to $120k with 3% growth, it will be $123.6k next year.

2. **Events Override, Not Add**: A salary change event sets a new baseline, it doesn't add to the growing salary. If your salary has grown to $90k and you add a "salary change to $85k" event (pay cut), it becomes $85k at that point.

3. **One-Time vs State Change**:
   - One-time events are spikes (affect one month)
   - State changes are steps (affect all future months)

4. **Order Matters**: Events on the same date are processed in order: income → state changes → debt payments → expenses

5. **Compounding Effects**:
   - Investment returns compound monthly
   - Salary/expense growth compounds annually
   - Events can create step changes that then compound

## UI Organization

The Configuration tab is organized to reflect this model:

### Base Configuration Section
- Income & Salary (starting + automatic growth)
- Tax Brackets
- Expenses & Inflation (starting + automatic growth)
- Savings & Investments (rate + returns)

### Events & Milestones Section
- List of all manual events
- Add/edit/delete events
- Each event shows date, type, and summary

This separation makes it clear:
- **Top section** = the automatic, predictable baseline
- **Bottom section** = the manual overrides and life events
