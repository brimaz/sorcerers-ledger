export const TermsOfService = {
  props: {
    gameConfig: {
      type: Object,
      default: () => ({
        GAME_TITLE: "Sorcerer's Ledger",
        GAME_NAME: "Sorcery: Contested Realm™",
        PUBLISHER_NAME: "Erik's Curiosa Limited",
        CONTACT_EMAIL: "contact@sorcerersledger.com"
      })
    }
  },
  computed: {
    gameTitle() {
      return this.gameConfig?.GAME_TITLE || "Sorcerer's Ledger";
    },
    gameName() {
      return this.gameConfig?.GAME_NAME || "Sorcery: Contested Realm™";
    },
    publisherName() {
      return this.gameConfig?.PUBLISHER_NAME || "Erik's Curiosa Limited";
    },
    contactEmail() {
      return this.gameConfig?.CONTACT_EMAIL || "contact@sorcerersledger.com";
    }
  },
  mounted() {
    document.title = `${this.gameTitle} - ToS`;
  },
  template: `
    <div class="terms-page">
        <h1>{{ gameTitle }} Terms of Use</h1>
        <p class="effective-date"><i>Effective Date: December 2<sup>nd</sup>, 2025</i></p>
        
        <p>Please read these Terms of Use ("Terms") carefully before using the {{ gameTitle }} website ("Service") operated by Legendary Ledgers LLC ("us," "we," or "our"). Your access to and use of the Service is conditioned on your acceptance of and compliance with these Terms.</p>
        
        <h2>1. Acceptance of Terms</h2>
        <p>By accessing or using the Service you agree to be bound by these Terms. If you disagree with any part of the terms, then you may not access the Service.</p>
        
        <h2>2. The Service</h2>
        <p>{{ gameTitle }} is a platform that provides data and information related to the pricing of cards for the game {{ gameName }}. The Service strictly provides <strong>pricing-related data</strong> and does not contain articles, editorials, or other non-pricing related content.</p>
        
        <h2>3. Intellectual Property Ownership</h2>
        
        <h3>A. Ownership and Control of {{ gameTitle }}</h3>
        <ul>
            <li><strong>{{ gameTitle }}</strong> is independently <strong>owned, operated, and controlled by Legendary Ledgers LLC.</strong></li>
            <li>All <strong>proprietary software, algorithms, website design, and original text content</strong> (excluding the Third-Party Intellectual Property listed in Section 3.B) are the <strong>exclusive property of Legendary Ledgers LLC</strong> and are protected by copyright law and international treaties.</li>
        </ul>
        
        <h3>B. Third-Party Intellectual Property</h3>
        <ul>
            <li><strong>{{ gameTitle }} is an independent fan project and is in no way affiliated with or endorsed by {{ publisherName }}.</strong></li>
            <li><strong>{{ publisherName }}®</strong>, <strong>{{ gameName }}</strong>, and associated set names are <strong>trademarks of {{ publisherName }}.</strong></li>
            <li>{{ gameName }} characters, card names, logos, and game content are the <strong>copyrighted property of {{ publisherName }}.</strong></li>
            <li>The individual <strong>artists who create illustrations</strong> for {{ gameName }} <strong>retain the copyright to their original artwork</strong>. This policy, established by {{ publisherName }}, allows artists to sell prints, playmats, and other merchandise featuring their work.</li>
        </ul>
        
        <h2>4. Restrictions on Use</h2>
        <p>You agree not to use the Service in a manner that is illegal, harmful, or prohibited by these Terms. Specifically, you agree not to:</p>
        <ul>
            <li><strong>Scrape, data mine, or use automated systems</strong> to extract data from the Service for commercial purposes without our express written permission.</li>
            <li>Reproduce, duplicate, copy, sell, resell, or exploit any portion of the Service, use of the Service, or access to the Service.</li>
            <li>Interfere with or disrupt the Service or servers or networks connected to the Service.</li>
        </ul>
        
        <h2>5. Disclaimer of Warranties</h2>
        <p>The Service is provided on an "AS IS" and "AS AVAILABLE" basis. We make no representations or warranties of any kind, express or implied, as to the operation of the Service or the accuracy, reliability, or completeness of the data provided. <strong>Pricing data is for informational purposes only</strong> and should not be relied upon for making purchasing or trading decisions.</p>
        
        <h2>6. Limitation of Liability</h2>
        <p>In no event shall Legendary Ledgers LLC, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from: (i) your access to or use of or inability to access or use the Service; (ii) any conduct or content of any third party on the Service; (iii) any pricing data errors or omissions; and (iv) unauthorized access, use or alteration of your transmissions or content, whether based on warranty, contract, tort (including negligence) or any other legal theory, whether or not we have been informed of the possibility of such damage.</p>
        
        <h2>7. Changes to Terms</h2>
        <p>We reserve the right, at our sole discretion, to modify or replace these Terms at any time. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.</p>
        
        <h2>8. Governing Law</h2>
        <p>These Terms shall be governed and construed in accordance with the laws of Virginia, without regard to its conflict of law provisions.</p>
        
        <h2>9. Contact Us</h2>
        <p>If you have any questions about these Terms, please contact us at <a :href="'mailto:' + contactEmail">{{ contactEmail }}</a>.</p>
    </div>
  `
}

