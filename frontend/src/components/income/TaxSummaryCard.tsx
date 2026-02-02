import type { AnnualIncomeSummary } from '@/lib/api-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Currency } from '@/components/ui/currency';

interface TaxSummaryCardProps {
  summary: AnnualIncomeSummary;
}

const formatPercent = (rate: number) => {
  return (rate * 100).toFixed(2) + '%';
};

export function TaxSummaryCard({ summary }: TaxSummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tax Breakdown</CardTitle>
        <CardDescription>
          Estimated taxes for {summary.tax_year}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Income Section */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Income</h4>
            <div className="grid gap-2">
              <div className="flex justify-between">
                <span className="text-sm">Employment</span>
                <Currency amount={summary.employment_income} className="text-sm font-medium" />
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Investment</span>
                <Currency amount={summary.investment_income} className="text-sm font-medium" />
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Rental</span>
                <Currency amount={summary.rental_income} className="text-sm font-medium" />
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Business</span>
                <Currency amount={summary.business_income} className="text-sm font-medium" />
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Other</span>
                <Currency amount={summary.other_income} className="text-sm font-medium" />
              </div>
              {summary.stock_options_benefit > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm">Stock Options Benefit</span>
                  <Currency amount={summary.stock_options_benefit} className="text-sm font-medium" />
                </div>
              )}
              <div className="border-t pt-2 flex justify-between font-medium">
                <span>Total Taxable Income</span>
                <Currency amount={summary.total_taxable_income} />
              </div>
            </div>
          </div>

          {/* Tax Section */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Taxes & Deductions</h4>
            <div className="grid gap-2">
              <div className="flex justify-between">
                <span className="text-sm">Federal Tax</span>
                <Currency amount={summary.federal_tax} negative className="text-sm font-medium text-negative" />
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Provincial Tax</span>
                <Currency amount={summary.provincial_tax} negative className="text-sm font-medium text-negative" />
              </div>
              <div className="flex justify-between">
                <span className="text-sm">CPP Contribution</span>
                <Currency amount={summary.cpp_contribution} negative className="text-sm font-medium text-negative" />
              </div>
              <div className="flex justify-between">
                <span className="text-sm">EI Contribution</span>
                <Currency amount={summary.ei_contribution} negative className="text-sm font-medium text-negative" />
              </div>
              <div className="border-t pt-2 flex justify-between font-medium">
                <span>Total Tax</span>
                <Currency amount={summary.total_tax} negative className="text-negative" />
              </div>
            </div>
          </div>

          {/* Summary Section */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex justify-between text-lg font-bold">
              <span>Net Income</span>
              <Currency amount={summary.net_income} className="text-positive" />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{formatPercent(summary.effective_tax_rate)}</div>
                <div className="text-xs text-muted-foreground">Effective Rate</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{formatPercent(summary.marginal_tax_rate)}</div>
                <div className="text-xs text-muted-foreground">Marginal Rate</div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
