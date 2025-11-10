export const ImageModal = {
  props: [
    'imageUrl',
    'isFoilPage',
    'showModal',
  ],
  data() {
      return {
          showNoImageMessage: false,
      }
  },
  watch: {
      imageUrl: {
          immediate: true,
          handler(newVal) {
              this.showNoImageMessage = false; // Reset when imageUrl changes
          }
      }
  },
  template: `
    <div id="mobile-image-modal" class="modal-overlay" :style="{ display: showModal ? 'flex' : 'none' }" @click.self="hideModal">
      <div class="modal-content">
        <button class="modal-close-button" @click="hideModal"><img src="assets/sl-modal-close.png" alt="Close"></button>
        <img v-if="imageUrl" :src="imageUrl" alt="Card Image Not Available" class="modal-image" :class="{ 'foil-sheen': isFoilPage }" @contextmenu.prevent="" @error="handleImageError">
        <div v-if="!imageUrl || showNoImageMessage" class="modal-no-image-text">Card Image Not Available</div>
      </div>
    </div>
  `,
  methods: {
    hideModal() {
      this.$emit('hide-modal');
    },
    handleImageError(event) {
        event.target.style.display = 'none';
        this.showNoImageMessage = true;
    },
  },
};

export const HoverImage = {
    props: [
        'imageUrl',
        'isFoilPage',
        'hoverPosition',
    ],
    data() {
        return {
            showNoImageMessage: false,
        }
    },
    watch: {
        imageUrl: {
            immediate: true,
            handler(newVal) {
                this.showNoImageMessage = false; // Reset when imageUrl changes
            }
        }
    },
    template: `
        <div id="hover-image-display" class="hover-image" :style="hoverImageStyle" v-if="imageUrl || showNoImageMessage">
            <img v-if="imageUrl" :src="imageUrl" alt="Card Image Not Available" :class="{ 'foil-sheen': isFoilPage }" @contextmenu.prevent="" @error="handleImageError">
            <div v-if="!imageUrl || showNoImageMessage" class="hover-image-text">Card Image Not Available</div>
        </div>
    `,
    computed: {
        hoverImageStyle() {
            return {
                position: 'absolute',
                top: this.hoverPosition.top + 'px',
                left: this.hoverPosition.left + 'px',
            };
        },
    },
    methods: {
        handleImageError(event) {
            event.target.style.display = 'none';
            this.showNoImageMessage = true;
        },
    },
}
