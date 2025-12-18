export const WhatsNew = {
  props: {
    gameConfig: {
      type: Object,
      default: () => ({
        GAME_TITLE: "Sorcerer's Ledger",
      }),
    },
    sourceUrl: {
      type: String,
      default: '/whats-new.json',
    },
  },
  data() {
    return {
      releases: [],
      isLoading: false,
      loadError: null,
    };
  },
  async mounted() {
    if (!this.sourceUrl) {
      return;
    }

    this.isLoading = true;
    this.loadError = null;

    try {
      const response = await fetch(this.sourceUrl);
      if (!response.ok) {
        throw new Error(`Failed to load what's new data (${response.status})`);
      }

      const data = await response.json();
      const releases = Array.isArray(data)
        ? data
        : Array.isArray(data.releases)
          ? data.releases
          : [];

      this.releases = releases;
    } catch (error) {
      console.warn("Failed to load what's new data:", error);
      this.loadError = "Unable to load recent updates right now.";
    } finally {
      this.isLoading = false;
    }
  },
  computed: {
    hasReleases() {
      return Array.isArray(this.releases) && this.releases.length > 0;
    },
    gameTitle() {
      return this.gameConfig?.GAME_TITLE || "Sorcerer's Ledger";
    },
  },
  template: `
    <div class="whats-new-page">
      <h1>What's New in {{ gameTitle }}</h1>

      <p v-if="isLoading">
        Loading recent updates...
      </p>

      <p v-else-if="loadError">
        {{ loadError }}
      </p>
      
      <p v-else-if="!hasReleases">
        There are no published updates yet. Check back soon for release notes!
      </p>

      <div v-else class="whats-new-releases">
        <section
          v-for="release in releases"
          :key="release.version"
          class="whats-new-release"
        >
          <h2>
            <span class="whats-new-version">{{ release.version }}</span>
            <small v-if="release.date" class="whats-new-date"> - {{ release.date }}</small>
          </h2>
          <ul class="whats-new-changes">
            <li v-for="(change, index) in release.changes" :key="index">
              {{ change }}
            </li>
          </ul>
        </section>
      </div>
    </div>
  `,
};


