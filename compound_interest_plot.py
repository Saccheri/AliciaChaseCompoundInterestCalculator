"""
Compound interest projection for a bank account.

Interest is calculated daily at the annual rate / 365 and credited
to the balance at the end of each calendar month. Credited interest
remains in the account and compounds thereafter.
"""

from __future__ import annotations

from calendar import monthrange
from datetime import date, timedelta
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.ticker import FuncFormatter


STARTING_BALANCE = 21_500.00
ANNUAL_RATE = 0.045
DAILY_RATE = ANNUAL_RATE / 365
START_DATE = date.today()
OUTPUT_PDF = Path(__file__).with_name("account_balance_projection.pdf")


def end_of_month(d: date) -> date:
    return date(d.year, d.month, monthrange(d.year, d.month)[1])


def add_months(d: date, months: int) -> date:
    """Return the same day-of-month `months` later, clamped to month length."""
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    day = min(d.day, monthrange(year, month)[1])
    return date(year, month, day)


def project_balances(
    start_balance: float,
    start_date: date,
    plot_start: date,
    plot_end: date,
) -> tuple[list[date], list[float]]:
    """
    Simulate daily accrual with month-end credit.

    Returns dates and balances from plot_start through plot_end (inclusive),
    sampled at each month-end and at plot_end.
    """
    balance = start_balance
    accrued = 0.0
    current = start_date

    month_end_balances: dict[date, float] = {}

    # Simulate day-by-day until the plot end date.
    while current <= plot_end:
        accrued += balance * DAILY_RATE

        if current == end_of_month(current):
            balance += accrued
            accrued = 0.0
            month_end_balances[current] = balance

        current += timedelta(days=1)

    dates: list[date] = []
    balances: list[float] = []

    # Collect month-end points in the plot window (12 months after this month).
    point = end_of_month(plot_start)
    while point <= plot_end:
        if point in month_end_balances:
            dates.append(point)
            balances.append(month_end_balances[point])
        point = end_of_month(add_months(point, 1))

    return dates, balances


def format_pounds(value: float, _pos: int | None = None) -> str:
    return f"£{value:,.0f}"


def create_plot(dates: list[date], balances: list[float], output_path: Path) -> None:
    fig, ax = plt.subplots(figsize=(11, 6.5))

    ax.plot(dates, balances, color="#1B4F72", linewidth=2.25, marker="o", markersize=6)
    ax.fill_between(dates, balances, balances[0], alpha=0.12, color="#1B4F72")

    for d, bal in zip(dates, balances):
        ax.annotate(
            f"£{bal:,.2f}",
            xy=(d, bal),
            xytext=(0, 10),
            textcoords="offset points",
            ha="center",
            va="bottom",
            fontsize=8,
            color="#1B4F72",
        )

    ax.set_title(
        "Bank Account Balance Projection\n"
        f"£{STARTING_BALANCE:,.0f} from {START_DATE:%d %b %Y} · "
        f"{ANNUAL_RATE:.1%} p.a. (daily accrual, monthly credit)",
        fontsize=13,
        pad=14,
    )
    ax.set_xlabel("Date")
    ax.set_ylabel("Account balance")
    ax.yaxis.set_major_formatter(FuncFormatter(format_pounds))
    ax.xaxis.set_major_locator(mdates.MonthLocator())
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %Y"))
    fig.autofmt_xdate(rotation=45)

    interest_earned = balances[-1] - STARTING_BALANCE
    ax.text(
        0.02,
        0.98,
        f"Starting balance: £{STARTING_BALANCE:,.2f}\n"
        f"Final balance: £{balances[-1]:,.2f}\n"
        f"Interest earned: £{interest_earned:,.2f}",
        transform=ax.transAxes,
        va="top",
        ha="left",
        fontsize=9,
        bbox=dict(boxstyle="round,pad=0.4", facecolor="white", edgecolor="#CCCCCC"),
    )

    ax.set_ylim(balances[0] * 0.995, balances[-1] * 1.012)
    ax.grid(True, linestyle="--", alpha=0.4)
    fig.tight_layout()
    fig.savefig(output_path, format="pdf")
    plt.close(fig)


def main() -> None:
    # Plot covers the 12 months after the end of the current month.
    this_month_end = end_of_month(START_DATE)
    plot_start = this_month_end + timedelta(days=1)  # first day of next month
    plot_end = end_of_month(add_months(this_month_end, 12))

    dates, balances = project_balances(
        STARTING_BALANCE, START_DATE, plot_start, plot_end
    )

    if not dates:
        raise RuntimeError("No month-end balances were produced for the plot window.")

    create_plot(dates, balances, OUTPUT_PDF)

    print(f"Start date:          {START_DATE:%Y-%m-%d}")
    print(f"Plot window:         {dates[0]:%Y-%m-%d} to {dates[-1]:%Y-%m-%d}")
    print(f"Starting balance:    £{STARTING_BALANCE:,.2f}")
    print(f"Final balance:       £{balances[-1]:,.2f}")
    print(f"Interest earned:     £{balances[-1] - STARTING_BALANCE:,.2f}")
    print(f"PDF written to:      {OUTPUT_PDF.resolve()}")


if __name__ == "__main__":
    main()
