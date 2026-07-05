export const FAQS = [
  {
    q: "What is EarnOmni?",
    a: "EarnOmni is a task-completion and ad-watching earning platform where users earn USDT (a US-dollar-pegged cryptocurrency) by completing simple online tasks — including watching ads, referring friends, and other daily activities. It's designed for anyone, regardless of experience, who wants a straightforward way to earn extra income online.",
  },
  {
    q: "How do I earn money on EarnOmni?",
    a: "You earn by completing tasks available in your dashboard: watching ads, finishing daily activities, and referring new users. Each completed task adds points to your balance, which convert to USDT that you can withdraw once you reach the minimum threshold.",
  },
  {
    q: "Is EarnOmni free to join?",
    a: "Yes. Creating an EarnOmni account is completely free. You can start completing tasks and earning immediately after signing up and confirming your email.",
  },
  {
    q: "What currency do I get paid in, and how do withdrawals work?",
    a: "Earnings are paid out in USDT, a stable cryptocurrency pegged to the US dollar. Once your balance reaches the minimum withdrawal amount, you can request a payout from the Withdraw page in your dashboard.",
  },
  {
    q: "How does the referral program work?",
    a: "Every user gets a unique referral link. When someone signs up using your link and starts earning, you receive a commission on their earnings — giving you an additional, passive way to grow your income on EarnOmni.",
  },
  {
    q: "Is EarnOmni safe and legitimate?",
    a: "EarnOmni uses secure authentication and encrypted data storage to protect user accounts, and includes fraud-detection safeguards to keep task completion and earnings fair for everyone. As with any online earning platform, we recommend using a strong, unique password and never sharing your account credentials.",
  },
  {
    q: "Who built EarnOmni?",
    a: "EarnOmni is developed and maintained by i5Digital Hub LLC, a software development company focused on building practical, user-first digital products.",
  },
];

export const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: f.a,
    },
  })),
};
