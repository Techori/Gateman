// Utility functions for payment frequency calculations
export function calculatePaymentAmount(monthlyRent: number, frequency: "weekly" | "bi-weekly" | "monthly"): number {
    switch (frequency) {
        case "weekly":
            return Math.round((monthlyRent * 12) / 52); // Convert monthly to weekly
        case "bi-weekly":
            return Math.round((monthlyRent * 12) / 26); // Convert monthly to bi-weekly (15 days)
        case "monthly":
        default:
            return monthlyRent;
    }
}

export function calculateNextPaymentDate(currentDate: Date, frequency: "weekly" | "bi-weekly" | "monthly", rentDay?: number): Date {
    const nextPayment = new Date(currentDate);
    
    switch (frequency) {
        case "weekly":
            nextPayment.setDate(nextPayment.getDate() + 7);
            break;
        case "bi-weekly":
            nextPayment.setDate(nextPayment.getDate() + 15);
            break;
        case "monthly":
        default:
            if (rentDay && rentDay >= 1 && rentDay <= 31) {
                nextPayment.setDate(rentDay);
                // If the rent day has passed this month, move to next month
                if (nextPayment <= currentDate) {
                    nextPayment.setMonth(nextPayment.getMonth() + 1);
                }
            } else {
                nextPayment.setMonth(nextPayment.getMonth() + 1);
            }
            break;
    }
    
    return nextPayment;
}

export function getFrequencyDays(frequency: "weekly" | "bi-weekly" | "monthly"): number {
    switch (frequency) {
        case "weekly":
            return 7;
        case "bi-weekly":
            return 15;
        case "monthly":
        default:
            return 30; // Approximate for monthly
    }
}

export function getFrequencyDescription(frequency: "weekly" | "bi-weekly" | "monthly"): string {
    switch (frequency) {
        case "weekly":
            return "Every 7 days";
        case "bi-weekly":
            return "Every 15 days";
        case "monthly":
        default:
            return "Monthly";
    }
}

export function calculateTotalPayments(totalMonths: number, frequency: "weekly" | "bi-weekly" | "monthly"): number {
    switch (frequency) {
        case "weekly":
            return Math.ceil((totalMonths * 30) / 7); // Approximate weeks in the period
        case "bi-weekly":
            return Math.ceil((totalMonths * 30) / 15); // Approximate bi-weekly periods
        case "monthly":
        default:
            return totalMonths;
    }
}

export function getDigioFrequency(frequency: "weekly" | "bi-weekly" | "monthly"): "monthly" | "weekly" {
    // Map our frequencies to Digio's supported frequencies
    switch (frequency) {
        case "weekly":
            return "weekly";
        case "bi-weekly":
            // Digio might not support bi-weekly, so we'll use monthly and handle bi-weekly logic in our scheduler
            return "monthly";
        case "monthly":
        default:
            return "monthly";
    }
}

export function validatePaymentFrequency(frequency: string): frequency is "weekly" | "bi-weekly" | "monthly" {
    return ["weekly", "bi-weekly", "monthly"].includes(frequency);
}
