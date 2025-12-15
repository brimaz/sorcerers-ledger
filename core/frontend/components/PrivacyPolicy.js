export const PrivacyPolicy = {
  props: {
    gameConfig: {
      type: Object,
      default: () => ({
        GAME_TITLE: "Sorcerer's Ledger",
        CONTACT_EMAIL: "contact@sorcerersledger.com"
      })
    }
  },
  computed: {
    gameTitle() {
      return this.gameConfig?.GAME_TITLE || "Sorcerer's Ledger";
    },
    contactEmail() {
      return this.gameConfig?.CONTACT_EMAIL || "contact@sorcerersledger.com";
    }
  },
  mounted() {
    document.title = `${this.gameTitle} - Privacy Policy`;
  },
  template: `
    <div class="privacy-page">
        <h1>{{ gameTitle }} Privacy Policy</h1>
        <p class="effective-date"><i>Effective Date: December 2<sup>nd</sup>, 2025</i></p>
        
        <p>This Privacy Policy describes how Legendary Ledgers LLC ("{{ gameTitle }}," "we," "us," or "our") uses and protects any information that you give us when you use our website.</p>
        
        <h2>1. Information We Do Not Collect Directly</h2>
        <p>We are committed to providing you with pricing data while maintaining your privacy.</p>
        <ul>
            <li><strong>No Personal Data Collection:</strong> We <strong>do not</strong> directly collect or store personally identifiable information (such as names, email addresses, payment information, physical addresses, or user accounts) from users accessing our site.</li>
            <li><strong>No Tracking of Usage:</strong> We <strong>do not</strong> use cookies, pixels, or other third-party tracking technologies to record your specific browsing activity or usage patterns on {{ gameTitle }}.</li>
        </ul>
        
        <h2>2. Third-Party Data Collection</h2>
        <p>While we do not collect data directly, your usage is subject to the data collection practices of third-party services you interact with through our site:</p>
        <ul>
            <li><strong>Affiliate Links (TCGplayer):</strong> Our Service includes links to external vendor websites, primarily <strong>TCGplayer</strong>, for card purchases. These links are <strong>affiliate links</strong>, meaning we may earn a commission when you click through and make a purchase.</li>
            <li><strong>Data Collected by Vendors:</strong> When you click on an affiliate link, you are leaving our site and going to the third-party vendor's website (e.g., TCGplayer). <strong>These vendors will collect data from you, including information necessary to process your transaction (e.g., payment, shipping details), your IP address, and information about the items you purchase.</strong></li>
            <li><strong>Your Relationship with Vendors:</strong> Your interactions and transactions on those third-party sites are governed by their own privacy policies. We encourage you to review the privacy policy of <strong>TCGplayer</strong> and any other external site before providing any personal information.</li>
            <li><strong>Data Shared with Us:</strong> While we receive aggregated, non-personally identifiable data from our affiliate program showing the volume and general nature of sales (e.g., "A user purchased Card X"), <strong>we do not receive any of your personal details, such as your name, contact information, or what you are buying specifically.</strong></li>
        </ul>
        
        <h2>3. Links to Other Websites</h2>
        <p>Our Service contains links to other websites, primarily for the purpose of purchasing cards. We have no control over, and assume no responsibility for, the content, privacy policies, or practices of any third-party websites or services. The presence of a link on our site is not an endorsement of that site.</p>
        
        <h2>4. Children's Privacy</h2>
        <p>Our Service is not directed to individuals under the age of 13. We do not knowingly collect personally identifiable information from children under 13. If you are a parent or guardian and you are aware that your child has provided us with personal data, please contact us so we can take necessary actions.</p>
        
        <h2>5. Changes to This Privacy Policy</h2>
        <p>We may update our Privacy Policy from time to time. You are advised to review this Privacy Policy periodically for any changes.</p>
        
        <h2>6. Contact Us</h2>
        <p>If you have any questions about this Privacy Policy, please contact us:</p>
        <ul>
            <li><strong>Email:</strong> <a :href="'mailto:' + contactEmail">{{ contactEmail }}</a></li>
        </ul>
    </div>
  `
}

