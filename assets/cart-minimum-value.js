/**
 * Cart Minimum Value - Implementação de valor mínimo de compra
 * Valor mínimo: R$90,00 (9000 centavos)
 */

class CartMinimumValue {
  constructor() {
    this.minimumValue = 9000; // R$90,00 em centavos
    this.errorMessage = 'O valor mínimo para compra é de R$90,00';
    
    // Elementos do carrinho que serão manipulados
    this.checkoutButtons = [];
    this.errorContainer = null;
    
    // Inicializa a validação
    this.init();
  }
  
  init() {
    // Inicializa imediatamente
    this.setupElements();
    this.validateCart();
    this.setupEventListeners();
  }
  
  setupElements() {
    // Botões de checkout na página do carrinho
    const mainCartCheckoutBtn = document.querySelector('#checkout');
    if (mainCartCheckoutBtn) {
      this.checkoutButtons.push(mainCartCheckoutBtn);
    }
    
    // Botão de checkout no drawer do carrinho
    const drawerCheckoutBtn = document.querySelector('#CartDrawer-Checkout');
    if (drawerCheckoutBtn) {
      this.checkoutButtons.push(drawerCheckoutBtn);
    }
    
    // Botão de checkout na notificação do carrinho
    const notificationCheckoutBtn = document.querySelector('#cart-notification-form button[name="checkout"]');
    if (notificationCheckoutBtn) {
      this.checkoutButtons.push(notificationCheckoutBtn);
    }
    
    // Container para mensagens de erro na página do carrinho
    this.errorContainer = document.querySelector('#cart-errors');
    if (!this.errorContainer) {
      this.errorContainer = document.querySelector('#CartDrawer-CartErrors');
    }
  }
  
  setupEventListeners() {
    // Monitora todos os possíveis eventos de atualização do carrinho
    const cartEvents = [
      'cart:updated', 'cart:update', 'cart:refresh', 'cart:change',
      'cart:added', 'cart:item-added', 'cart-drawer:open'
    ];
    
    cartEvents.forEach(eventName => {
      document.addEventListener(eventName, () => {
        this.setupElements();
        this.validateCart();
      });
    });
    
    // Monitora quando o drawer do carrinho é aberto
    document.addEventListener('drawerOpen', (event) => {
      this.setupElements();
      this.validateCart();
    });
    
    // Monitora quando a notificação do carrinho é exibida
    const cartNotification = document.querySelector('#cart-notification');
    if (cartNotification) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'class' && 
              cartNotification.classList.contains('active')) {
            this.setupElements();
            this.validateCart();
          }
        });
      });
      
      observer.observe(cartNotification, { attributes: true });
    }
    
    // Adiciona evento de clique nos botões de checkout para validação adicional
    this.checkoutButtons.forEach(button => {
      button.addEventListener('click', (event) => {
        if (!this.isCartValid()) {
          event.preventDefault();
          this.showError();
        }
      });
    });
    
    // Adiciona um observador de mutação para o conteúdo do carrinho
    this.setupCartObserver();
  }
  
  /**
   * Obtém o valor total do carrinho em centavos
   */
  getCartTotal() {
    // Tenta obter o valor do carrinho do objeto window.Shopify
    if (window.Shopify && window.Shopify.cart) {
      return window.Shopify.cart.total_price || 0;
    }
    
    // Alternativa: buscar o valor do DOM usando data attributes
    const cartTotalElements = document.querySelectorAll('[data-cart-total]');
    if (cartTotalElements.length > 0) {
      for (const element of cartTotalElements) {
        const value = parseInt(element.getAttribute('data-cart-total') || '0');
        if (value > 0) return value;
      }
    }
    
    // Alternativa: buscar o valor do DOM usando classes
    const totalElements = document.querySelectorAll('.totals__total-value');
    if (totalElements.length > 0) {
      // Extrai apenas os números do texto do preço
      const priceText = totalElements[0].textContent;
      const numericValue = priceText.replace(/[^0-9]/g, '');
      return parseInt(numericValue, 10) || 0;
    }
    
    return 0;
  }
  
  /**
   * Verifica se o valor do carrinho é válido (maior ou igual ao mínimo)
   */
  isCartValid() {
    const cartTotal = this.getCartTotal();
    return cartTotal >= this.minimumValue;
  }
  
  /**
   * Valida o carrinho e atualiza a UI conforme necessário
   */
  validateCart() {
    if (this.isCartValid()) {
      this.enableCheckout();
      this.hideError();
    } else {
      this.disableCheckout();
      this.showError();
    }
  }
  
  /**
   * Habilita os botões de checkout
   */
  enableCheckout() {
    this.checkoutButtons.forEach(button => {
      button.disabled = false;
      button.classList.remove('button--disabled');
    });
  }
  
  /**
   * Desabilita os botões de checkout
   */
  disableCheckout() {
    this.checkoutButtons.forEach(button => {
      button.disabled = true;
      button.classList.add('button--disabled');
    });
  }
  
  /**
   * Exibe mensagem de erro
   */
  showError() {
    if (this.errorContainer) {
      this.errorContainer.textContent = this.errorMessage;
      this.errorContainer.style.display = 'block';
      this.errorContainer.classList.add('cart-error');
    }
    
    // Cria um elemento de erro para o drawer do carrinho se não existir
    if (!document.querySelector('.cart-drawer-error')) {
      const drawerFooter = document.querySelector('.cart-drawer__footer');
      if (drawerFooter) {
        const errorElement = document.createElement('div');
        errorElement.className = 'cart-drawer-error';
        errorElement.textContent = this.errorMessage;
        errorElement.style.color = 'red';
        errorElement.style.marginBottom = '10px';
        drawerFooter.prepend(errorElement);
      }
    }
    
    // Cria um elemento de erro para a notificação do carrinho se não existir
    const cartNotification = document.querySelector('#cart-notification.active');
    if (cartNotification && !cartNotification.querySelector('.cart-notification-error')) {
      const notificationLinks = cartNotification.querySelector('.cart-notification__links');
      if (notificationLinks) {
        const errorElement = document.createElement('div');
        errorElement.className = 'cart-notification-error';
        errorElement.textContent = this.errorMessage;
        errorElement.style.color = 'red';
        errorElement.style.marginBottom = '10px';
        notificationLinks.prepend(errorElement);
      }
    }
  }
  
  /**
   * Esconde mensagem de erro
   */
  hideError() {
    if (this.errorContainer) {
      this.errorContainer.textContent = '';
      this.errorContainer.style.display = 'none';
      this.errorContainer.classList.remove('cart-error');
    }
    
    // Remove mensagens de erro do drawer
    const drawerError = document.querySelector('.cart-drawer-error');
    if (drawerError) {
      drawerError.remove();
    }
    
    // Remove mensagens de erro da notificação
    const notificationError = document.querySelector('.cart-notification-error');
    if (notificationError) {
      notificationError.remove();
    }
  }
  
  /**
   * Configura um observador de mutação para o conteúdo do carrinho
   * para detectar mudanças dinâmicas no DOM
   */
  setupCartObserver() {
    const cartObserver = new MutationObserver(() => {
      this.setupElements();
      this.validateCart();
    });
    
    // Observar o carrinho principal
    const mainCart = document.getElementById('main-cart-items');
    if (mainCart) {
      cartObserver.observe(mainCart, { childList: true, subtree: true });
    }
    
    // Observar o drawer do carrinho
    const cartDrawer = document.getElementById('CartDrawer');
    if (cartDrawer) {
      cartObserver.observe(cartDrawer, { childList: true, subtree: true });
    }
    
    // Observar o formulário do carrinho
    const cartForm = document.getElementById('cart');
    if (cartForm) {
      cartObserver.observe(cartForm, { childList: true, subtree: true });
    }
  }
}

// Inicializa a validação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  new CartMinimumValue();
});

// Também inicializar quando o carrinho for atualizado via AJAX
document.addEventListener('cart:update', () => {
  new CartMinimumValue();
});

// Inicializa imediatamente para casos onde o DOM já está carregado
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  new CartMinimumValue();
}