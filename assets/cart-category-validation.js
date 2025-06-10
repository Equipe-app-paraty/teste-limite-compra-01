/**
 * Cart Category Validation - Implementação de validação de categoria de produtos
 * Regra: Produtos da categoria "cerveja" só podem ser comprados com "kit churrasco" OU "avulsos"
 * 
 * Este validador implementa um sistema de lock hierárquico para o botão de checkout,
 * priorizando a validação de dependência de categoria sobre a validação de valor mínimo.
 */

class CartCategoryValidation {
  constructor() {
    // Categorias que estamos monitorando
    this.beerCategory = 'cerveja';
    this.requiredCategories = ['kit churrasco', 'avulsos'];
    
    // Mensagem de erro para exibir quando a validação falhar
    this.errorMessage = 'Produtos da categoria "cerveja" só podem ser comprados com "kit churrasco" OU "avulsos"';
    
    // Referência para a instância de CartMinimumValue (será definida durante a inicialização)
    this.minimumValueValidator = null;
    
    // Elementos do carrinho que serão manipulados
    this.checkoutButtons = [];
    this.errorContainer = null;
    
    // Estado de validação
    this.isValid = true;
    
    // Lock hierárquico - prioridade mais alta (1) que o validador de valor mínimo (2)
    this.lockPriority = 1;
    this.checkoutLocked = false;
    
    // Inicializa a validação
    this.init();
    
    // Expõe a instância globalmente para coordenação com outros validadores
    window.cartCategoryValidation = this;
  }
  
  init() {
    // Encontra a instância de CartMinimumValue
    this.findMinimumValueValidator();
    
    // Inicializa imediatamente
    this.setupElements();
    this.validateCart();
    this.setupEventListeners();
  }
  
  /**
   * Encontra a instância de CartMinimumValue para coordenação
   */
  findMinimumValueValidator() {
    // Aguarda um pequeno tempo para garantir que CartMinimumValue já foi inicializado
    setTimeout(() => {
      // Verifica se a instância global existe
      if (window.cartMinimumValueInstance) {
        this.minimumValueValidator = window.cartMinimumValueInstance;
        
        // Sobrescreve o método validateCart do CartMinimumValue para coordenar as validações
        const originalValidateCart = this.minimumValueValidator.validateCart;
        this.minimumValueValidator.validateCart = () => {
          // Executa a validação original de valor mínimo
          originalValidateCart.call(this.minimumValueValidator);
          
          // Se a validação de categoria falhar, ela tem prioridade sobre a de valor mínimo
          if (!this.isValid) {
            this.minimumValueValidator.enableCheckout = function() {
              // Não faz nada quando a validação de categoria falha
              return false;
            };
            this.disableCheckout();
            this.showError();
          }
        };
      }
    }, 100);
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
    
    // Adiciona evento de clique nos botões de checkout para validação adicional
    this.checkoutButtons.forEach(button => {
      button.addEventListener('click', (event) => {
        if (!this.isValid) {
          event.preventDefault();
          this.showError();
        }
      });
    });
    
    // Adiciona um observador de mutação para o conteúdo do carrinho
    this.setupCartObserver();
  }
  
  /**
   * Verifica se o carrinho contém produtos da categoria "cerveja"
   */
  hasBeerProducts() {
    if (!window.Shopify || !window.Shopify.cart || !window.Shopify.cart.items) {
      return false;
    }
    
    return window.Shopify.cart.items.some(item => {
      // Verifica se o produto_type ou o handle contém a palavra "cerveja"
      return (
        (item.product_type && item.product_type.toLowerCase().includes(this.beerCategory)) ||
        (item.handle && item.handle.toLowerCase().includes(this.beerCategory))
      );
    });
  }
  
  /**
   * Verifica se o carrinho contém pelo menos um produto das categorias obrigatórias
   */
  hasRequiredCategoryProducts() {
    if (!window.Shopify || !window.Shopify.cart || !window.Shopify.cart.items) {
      return false;
    }
    
    return window.Shopify.cart.items.some(item => {
      return this.requiredCategories.some(category => {
        // Verifica se o product_type ou o handle contém alguma das categorias obrigatórias
        return (
          (item.product_type && item.product_type.toLowerCase().includes(category)) ||
          (item.handle && item.handle.toLowerCase().includes(category))
        );
      });
    });
  }
  
  /**
   * Verifica se o carrinho é válido de acordo com as regras de categoria
   */
  isCartValid() {
    // Se não há produtos de cerveja, não há restrições de categoria
    if (!this.hasBeerProducts()) {
      return true;
    }
    
    // Se há produtos de cerveja, deve haver pelo menos um produto das categorias obrigatórias
    return this.hasRequiredCategoryProducts();
  }
  
  /**
   * Valida o carrinho e atualiza a UI conforme necessário
   */
  validateCart() {
    const previousState = this.isValid;
    this.isValid = this.isCartValid();
    
    if (this.isValid) {
      this.checkoutLocked = false;
      this.hideError();
      // Permite que o CartMinimumValue assuma o controle se a validação de categoria passar
      if (this.minimumValueValidator) {
        this.minimumValueValidator.validateCart();
      }
    } else {
      this.checkoutLocked = true;
      this.disableCheckout();
      this.showError();
    }
    
    // Se o estado mudou, dispara um evento personalizado para notificar outros validadores
    if (previousState !== this.isValid) {
      document.dispatchEvent(new CustomEvent('category-validation-changed', {
        detail: { isValid: this.isValid, validator: this }
      }));
    }
  }
  
  /**
   * Desabilita os botões de checkout
   */
  disableCheckout() {
    this.checkoutButtons.forEach(button => {
      button.disabled = true;
      button.classList.add('button--disabled');
      
      // Adiciona um atributo data para indicar qual validador bloqueou o botão
      button.setAttribute('data-locked-by', 'category-validator');
      button.setAttribute('data-lock-priority', this.lockPriority);
    });
  }
  
  /**
   * Exibe mensagem de erro
   */
  showError() {
    if (this.errorContainer) {
      // Prioriza a mensagem de erro de categoria sobre a de valor mínimo
      this.errorContainer.textContent = this.errorMessage;
      this.errorContainer.style.display = 'block';
      this.errorContainer.classList.add('cart-error');
      
      // Adiciona atributo data para indicar qual validador está mostrando o erro
      this.errorContainer.setAttribute('data-error-by', 'category-validator');
      this.errorContainer.setAttribute('data-error-priority', this.lockPriority);
    }
    
    // Cria um elemento de erro para o drawer do carrinho se não existir
    const existingDrawerError = document.querySelector('.cart-drawer-error');
    if (!existingDrawerError) {
      const drawerFooter = document.querySelector('.cart-drawer__footer');
      if (drawerFooter) {
        const errorElement = document.createElement('div');
        errorElement.className = 'cart-drawer-error';
        errorElement.textContent = this.errorMessage;
        errorElement.style.color = 'red';
        errorElement.style.marginBottom = '10px';
        errorElement.setAttribute('data-error-by', 'category-validator');
        errorElement.setAttribute('data-error-priority', this.lockPriority);
        drawerFooter.prepend(errorElement);
      }
    } else {
      // Só atualiza a mensagem se este validador tiver prioridade mais alta
      const currentPriority = parseInt(existingDrawerError.getAttribute('data-error-priority') || '999');
      if (this.lockPriority < currentPriority) {
        existingDrawerError.textContent = this.errorMessage;
        existingDrawerError.setAttribute('data-error-by', 'category-validator');
        existingDrawerError.setAttribute('data-error-priority', this.lockPriority);
      }
    }
    
    // Cria um elemento de erro para a notificação do carrinho se não existir
    const cartNotification = document.querySelector('#cart-notification.active');
    const existingNotificationError = cartNotification?.querySelector('.cart-notification-error');
    
    if (cartNotification && !existingNotificationError) {
      const notificationLinks = cartNotification.querySelector('.cart-notification__links');
      if (notificationLinks) {
        const errorElement = document.createElement('div');
        errorElement.className = 'cart-notification-error';
        errorElement.textContent = this.errorMessage;
        errorElement.style.color = 'red';
        errorElement.style.marginBottom = '10px';
        errorElement.setAttribute('data-error-by', 'category-validator');
        errorElement.setAttribute('data-error-priority', this.lockPriority);
        notificationLinks.prepend(errorElement);
      }
    } else if (existingNotificationError) {
      // Só atualiza a mensagem se este validador tiver prioridade mais alta
      const currentPriority = parseInt(existingNotificationError.getAttribute('data-error-priority') || '999');
      if (this.lockPriority < currentPriority) {
        existingNotificationError.textContent = this.errorMessage;
        existingNotificationError.setAttribute('data-error-by', 'category-validator');
        existingNotificationError.setAttribute('data-error-priority', this.lockPriority);
      }
    }
  }
  
  /**
   * Esconde mensagem de erro
   */
  hideError() {
    // Só esconde as mensagens de erro se a validação de categoria estiver OK
    if (this.isValid) {
      // Verifica se os elementos de erro foram criados por este validador
      if (this.errorContainer && this.errorContainer.getAttribute('data-error-by') === 'category-validator') {
        // Permite que o validador de valor mínimo mostre seu erro, se necessário
        if (this.minimumValueValidator && !this.minimumValueValidator.isValid) {
          this.errorContainer.textContent = this.minimumValueValidator.errorMessage;
          this.errorContainer.setAttribute('data-error-by', 'minimum-value-validator');
          this.errorContainer.setAttribute('data-error-priority', '2');
        } else {
          this.errorContainer.textContent = '';
          this.errorContainer.style.display = 'none';
          this.errorContainer.classList.remove('cart-error');
          this.errorContainer.removeAttribute('data-error-by');
          this.errorContainer.removeAttribute('data-error-priority');
        }
      }
      
      // Gerencia mensagens de erro do drawer
      const drawerError = document.querySelector('.cart-drawer-error');
      if (drawerError && drawerError.getAttribute('data-error-by') === 'category-validator') {
        if (this.minimumValueValidator && !this.minimumValueValidator.isValid) {
          drawerError.textContent = this.minimumValueValidator.errorMessage;
          drawerError.setAttribute('data-error-by', 'minimum-value-validator');
          drawerError.setAttribute('data-error-priority', '2');
        } else {
          drawerError.remove();
        }
      }
      
      // Gerencia mensagens de erro da notificação
      const notificationError = document.querySelector('.cart-notification-error');
      if (notificationError && notificationError.getAttribute('data-error-by') === 'category-validator') {
        if (this.minimumValueValidator && !this.minimumValueValidator.isValid) {
          notificationError.textContent = this.minimumValueValidator.errorMessage;
          notificationError.setAttribute('data-error-by', 'minimum-value-validator');
          notificationError.setAttribute('data-error-priority', '2');
        } else {
          notificationError.remove();
        }
      }
      
      // Gerencia o estado dos botões de checkout
      this.checkoutButtons.forEach(button => {
        if (button.getAttribute('data-locked-by') === 'category-validator') {
          if (this.minimumValueValidator && !this.minimumValueValidator.isValid) {
            // Transfere o lock para o validador de valor mínimo
            button.setAttribute('data-locked-by', 'minimum-value-validator');
            button.setAttribute('data-lock-priority', '2');
          } else {
            // Remove o lock completamente
            button.disabled = false;
            button.classList.remove('button--disabled');
            button.removeAttribute('data-locked-by');
            button.removeAttribute('data-lock-priority');
          }
        }
      });
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
  if (!window.cartCategoryValidation) {
    window.cartCategoryValidation = new CartCategoryValidation();
  }
});

// Também inicializar quando o carrinho for atualizado via AJAX
document.addEventListener('cart:update', () => {
  if (!window.cartCategoryValidation) {
    window.cartCategoryValidation = new CartCategoryValidation();
  } else {
    window.cartCategoryValidation.validateCart();
  }
});

// Inicializa imediatamente para casos onde o DOM já está carregado
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  if (!window.cartCategoryValidation) {
    window.cartCategoryValidation = new CartCategoryValidation();
  }
}