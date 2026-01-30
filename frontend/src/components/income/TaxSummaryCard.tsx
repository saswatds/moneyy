import type { AnnualIncomeSummary } from '@/lib/api-client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface TaxSummaryCardProps {
  summary: AnnualIncomeSummary;
}

const formatNumber = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

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
                <span className="text-sm font-medium">${formatNumber(summary.employment_income)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Investment</span>
                <span className="text-sm font-medium">${formatNumber(summary.investment_income)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Rental</span>
                <span className="text-sm font-medium">${formatNumber(summary.rental_income)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Business</span>
                <span className="text-sm font-medium">${formatNumber(summary.business_income)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Other</span>
                <span className="text-sm font-medium">${formatNumber(summary.other_income)}</span>
              </div>
              {summary.stock_options_benefit > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm">Stock Options Benefit</span>
                  <span className="text-sm font-medium">${formatNumber(summary.stock_options_benefit)}</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between font-medium">
                <span>Total Taxable Income</span>
                <span>${formatNumber(summary.total_taxable_income)}</span>
              </div>
            </div>
          </div>

          {/* Tax Section */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Taxes & Deductions</h4>
            <div className="grid gap-2">
              <div className="flex justify-between">
                <span className="text-sm">Federal Tax</span>
                <span className="text-sm font-medium text-red-600">-${formatNumber(summary.federal_tax)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Provincial Tax</span>
                <span className="text-sm font-medium text-red-600">-${formatNumber(summary.provincial_tax)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">CPP Contribution</span>
                <span className="text-sm font-medium text-red-600">-${formatNumber(summary.cpp_contribution)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">EI Contribution</span>
                <span className="text-sm font-medium text-red-600">-${formatNumber(summary.ei_contribution)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-medium">
                <span>Total Tax</span>
                <span className="text-red-600">-${formatNumber(summary.total_tax)}</span>
              </div>
            </div>
          </div>

          {/* Summary Section */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex justify-between text-lg font-bold">
              <span>Net Income</span>
              <span className="text-green-600">${formatNumber(summary.net_income)}</span>
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
