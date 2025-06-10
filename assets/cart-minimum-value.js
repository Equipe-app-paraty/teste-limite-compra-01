/**
 * Cart Minimum Value - Implementação de valor mínimo de compra
 * Valor mínimo: R$90,00 (9000 centavos)
 * 
 * Este validador implementa um sistema de lock hierárquico para o botão de checkout,
 * com prioridade menor (2) que o validador de categoria (1).
 */

class CartMinimumValue {
  constructor() {
    this.minimumValue = 9000; // R$90,00 em centavos
    this.errorMessage = 'O valor mínimo para compra é de R$90,00';
    
    // Elementos do carrinho que serão manipulados
    this.checkoutButtons = [];
    this.errorContainer = null;
    
    // Estado de validação
    this.isValid = false;
    
    // Lock hierárquico - prioridade menor (2) que o validador de categoria (1)
    this.lockPriority = 2;
    this.checkoutLocked = false;
    
    // Controle de estado para evitar validações concorrentes
    this.validationInProgress = false;
    this.validationLocks = {
      value: false      // Lock para validação de valor mínimo
    };
    
    // Expõe a instância globalmente para coordenação com outros validadores
    window.cartMinimumValueInstance = this;
    
    // Inicializa a validação
    this.init();
  }
  
  init() {
    // Inicializa imediatamente
    this.setupElements();
    this.validateCart();
    this.setupEventListeners();
    
    // Escuta eventos do validador de categoria
    document.addEventListener('category-validation-changed', (event) => {
      if (event.detail && event.detail.isValid !== undefined) {
        // Se a validação de categoria mudou para válida, revalida o carrinho
        if (event.detail.isValid) {
          this.validateCart();
        }
      }
    });
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
        // Evita múltiplas validações simultâneas
        if (this.validationInProgress) return;
        
        this.setupElements();
        this.validateCart().catch(error => {
          console.error(`Erro ao validar valor mínimo após evento ${eventName}:`, error);
        });
      });
    });
    
    // Monitora quando o drawer do carrinho é aberto
    document.addEventListener('drawerOpen', (event) => {
      // Evita múltiplas validações simultâneas
      if (this.validationInProgress) return;
      
      this.setupElements();
      this.validateCart().catch(error => {
        console.error('Erro ao validar valor mínimo após abertura do drawer:', error);
      });
    });
    
    // Monitora quando a notificação do carrinho é exibida
    const cartNotification = document.querySelector('#cart-notification');
    if (cartNotification) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'class' && 
              cartNotification.classList.contains('active')) {
            // Evita múltiplas validações simultâneas
            if (this.validationInProgress) return;
            
            this.setupElements();
            this.validateCart().catch(error => {
              console.error('Erro ao validar valor mínimo após exibição da notificação:', error);
            });
          }
        });
      });
      
      observer.observe(cartNotification, { attributes: true });
    }
    
    // Adiciona evento de clique nos botões de checkout para validação adicional
    this.checkoutButtons.forEach(button => {
      button.addEventListener('click', async (event) => {
        // Validação de último momento antes do checkout
        if (this.validationInProgress) {
          // Se uma validação estiver em andamento, previne o checkout por segurança
          event.preventDefault();
          return;
        }
        
        try {
          // Verifica se o validador de categoria está bloqueando
          const categoryValidator = window.cartCategoryValidation;
          const categoryBlocking = categoryValidator && !categoryValidator.isValid;
          
          // Se a categoria já está bloqueando, não precisa validar o valor mínimo
          if (categoryBlocking) {
            event.preventDefault();
            return;
          }
          
          // Realiza uma validação rápida antes de permitir o checkout
          if (!this.isCartValid()) {
            event.preventDefault();
            this.showError();
          }
        } catch (error) {
          console.error('Erro na validação final de valor mínimo antes do checkout:', error);
          // Em caso de erro, permite o checkout para não bloquear o usuário indevidamente
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
    this.isValid = cartTotal >= this.minimumValue;
    return this.isValid;
  }
  
  /**
   * Valida o carrinho e atualiza a UI conforme necessário
   * @returns {Promise<void>}
   */
  async validateCart() {
    try {
      // Indica que a validação está em andamento para evitar conflitos
      if (this.validationInProgress) {
        return; // Evita validações concorrentes
      }
      
      this.validationInProgress = true;
      this.validationLocks.value = true;
      
      const previousState = this.isValid;
      this.isCartValid(); // Atualiza this.isValid
      
      // Verifica se o validador de categoria está bloqueando o checkout
      const categoryValidator = window.cartCategoryValidation;
      const categoryBlocking = categoryValidator && !categoryValidator.isValid;
      
      // Verifica se o validador de categoria está em processo de validação
      const categoryValidating = categoryValidator && categoryValidator.validationInProgress;
      
      // Se o validador de categoria estiver em processo de validação, aguarda um pouco
      if (categoryValidating) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      if (this.isValid) {
        this.checkoutLocked = false;
        // Só habilita o checkout se o validador de categoria não estiver bloqueando
        if (!categoryBlocking) {
          this.enableCheckout();
        }
        this.hideError();
      } else {
        this.checkoutLocked = true;
        this.disableCheckout();
        // Só mostra o erro se o validador de categoria não estiver mostrando um erro
        if (!categoryBlocking) {
          this.showError();
        }
      }
      
      // Se o estado mudou, dispara um evento personalizado para notificar outros validadores
      if (previousState !== this.isValid) {
        document.dispatchEvent(new CustomEvent('minimum-value-validation-changed', {
          detail: { isValid: this.isValid, validator: this }
        }));
      }
    } catch (error) {
      console.error('Erro durante a validação de valor mínimo:', error);
      // Em caso de erro, mantém o estado anterior para evitar bloqueios indevidos
      this.isValid = previousState || false;
    } finally {
      // Indica que a validação foi concluída
      this.validationLocks.value = false;
      this.validationInProgress = false;
    }
  }
  
  /**
   * Habilita os botões de checkout
   */
  enableCheckout() {
    this.checkoutButtons.forEach(button => {
      // Só habilita se o botão estiver bloqueado por este validador ou não estiver bloqueado
      const lockedBy = button.getAttribute('data-locked-by');
      if (!lockedBy || lockedBy === 'minimum-value-validator') {
        button.disabled = false;
        button.classList.remove('button--disabled');
        button.removeAttribute('data-locked-by');
        button.removeAttribute('data-lock-priority');
      }
    });
  }
  
  /**
   * Desabilita os botões de checkout
   */
  disableCheckout() {
    this.checkoutButtons.forEach(button => {
      // Verifica se já existe um lock com prioridade mais alta
      const currentPriority = parseInt(button.getAttribute('data-lock-priority') || '999');
      
      // Só aplica o lock se a prioridade deste validador for maior (número menor)
      if (this.lockPriority < currentPriority) {
        button.disabled = true;
        button.classList.add('button--disabled');
        button.setAttribute('data-locked-by', 'minimum-value-validator');
        button.setAttribute('data-lock-priority', this.lockPriority);
      }
    });
  }
  
  /**
   * Exibe mensagem de erro
   */
  showError() {
    // Verifica se o validador de categoria está mostrando um erro
    const categoryValidator = window.cartCategoryValidation;
    const categoryShowingError = categoryValidator && !categoryValidator.isValid;
    
    // Só mostra o erro se o validador de categoria não estiver mostrando um erro
    if (!categoryShowingError) {
      if (this.errorContainer) {
        // Verifica se já existe um erro com prioridade mais alta
        const currentPriority = parseInt(this.errorContainer.getAttribute('data-error-priority') || '999');
        
        // Só aplica o erro se a prioridade deste validador for maior (número menor)
        if (this.lockPriority < currentPriority) {
          this.errorContainer.textContent = this.errorMessage;
          this.errorContainer.style.display = 'block';
          this.errorContainer.classList.add('cart-error');
          this.errorContainer.setAttribute('data-error-by', 'minimum-value-validator');
          this.errorContainer.setAttribute('data-error-priority', this.lockPriority);
        }
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
          errorElement.setAttribute('data-error-by', 'minimum-value-validator');
          errorElement.setAttribute('data-error-priority', this.lockPriority);
          drawerFooter.prepend(errorElement);
        }
      } else {
        // Só atualiza a mensagem se este validador tiver prioridade mais alta
        const currentPriority = parseInt(existingDrawerError.getAttribute('data-error-priority') || '999');
        if (this.lockPriority < currentPriority) {
          existingDrawerError.textContent = this.errorMessage;
          existingDrawerError.setAttribute('data-error-by', 'minimum-value-validator');
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
          errorElement.setAttribute('data-error-by', 'minimum-value-validator');
          errorElement.setAttribute('data-error-priority', this.lockPriority);
          notificationLinks.prepend(errorElement);
        }
      } else if (existingNotificationError) {
        // Só atualiza a mensagem se este validador tiver prioridade mais alta
        const currentPriority = parseInt(existingNotificationError.getAttribute('data-error-priority') || '999');
        if (this.lockPriority < currentPriority) {
          existingNotificationError.textContent = this.errorMessage;
          existingNotificationError.setAttribute('data-error-by', 'minimum-value-validator');
          existingNotificationError.setAttribute('data-error-priority', this.lockPriority);
        }
      }
    }
  }
  
  /**
   * Esconde mensagem de erro
   */
  hideError() {
    // Só esconde as mensagens de erro criadas por este validador
    if (this.errorContainer && this.errorContainer.getAttribute('data-error-by') === 'minimum-value-validator') {
      this.errorContainer.textContent = '';
      this.errorContainer.style.display = 'none';
      this.errorContainer.classList.remove('cart-error');
      this.errorContainer.removeAttribute('data-error-by');
      this.errorContainer.removeAttribute('data-error-priority');
    }
    
    // Remove mensagens de erro do drawer criadas por este validador
    const drawerError = document.querySelector('.cart-drawer-error');
    if (drawerError && drawerError.getAttribute('data-error-by') === 'minimum-value-validator') {
      drawerError.remove();
    }
    
    // Remove mensagens de erro da notificação criadas por este validador
    const notificationError = document.querySelector('.cart-notification-error');
    if (notificationError && notificationError.getAttribute('data-error-by') === 'minimum-value-validator') {
      notificationError.remove();
    }
  }
  
  /**
   * Configura um observador de mutação para o conteúdo do carrinho
   * para detectar mudanças dinâmicas no DOM
   */
  setupCartObserver() {
    // Usa um temporizador para evitar múltiplas validações em sequência
    let debounceTimer;
    
    const cartObserver = new MutationObserver((mutations) => {
      // Verifica se as mutações são relevantes para a validação
      const relevantMutation = mutations.some(mutation => {
        // Mudanças na estrutura do DOM (adição/remoção de elementos)
        if (mutation.type === 'childList' && 
            (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
          return true;
        }
        
        // Mudanças em atributos relevantes (quantidade, preço, etc.)
        if (mutation.type === 'attributes' && 
            ['data-cart-item-quantity', 'data-cart-item-price', 'data-cart-item-key'].includes(mutation.attributeName)) {
          return true;
        }
        
        return false;
      });
      
      if (relevantMutation) {
        // Cancela qualquer validação pendente
        clearTimeout(debounceTimer);
        
        // Agenda uma nova validação após um pequeno atraso para agrupar múltiplas mudanças
        debounceTimer = setTimeout(() => {
          // Evita múltiplas validações simultâneas
          if (this.validationInProgress) return;
          
          this.setupElements();
          this.validateCart().catch(error => {
            console.error('Erro ao validar valor mínimo após mutação DOM:', error);
          });
        }, 150); // 150ms de debounce (um pouco mais que o validador de categoria para evitar conflitos)
      }
    });
    
    // Observar o carrinho principal
    const mainCart = document.getElementById('main-cart-items');
    if (mainCart) {
      cartObserver.observe(mainCart, { 
        childList: true, 
        subtree: true,
        attributes: true,
        attributeFilter: ['data-cart-item-quantity', 'data-cart-item-price', 'data-cart-item-key']
      });
    }
    
    // Observar o drawer do carrinho
    const cartDrawer = document.getElementById('CartDrawer');
    if (cartDrawer) {
      cartObserver.observe(cartDrawer, { 
        childList: true, 
        subtree: true,
        attributes: true,
        attributeFilter: ['data-cart-item-quantity', 'data-cart-item-price', 'data-cart-item-key']
      });
    }
    
    // Observar o formulário do carrinho
    const cartForm = document.getElementById('cart');
    if (cartForm) {
      cartObserver.observe(cartForm, { 
        childList: true, 
        subtree: true,
        attributes: true,
        attributeFilter: ['data-cart-item-quantity', 'data-cart-item-price', 'data-cart-item-key']
      });
    }
  }
}

// Inicializa a validação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  if (!window.cartMinimumValueInstance) {
    window.cartMinimumValueInstance = new CartMinimumValue();
  }
});

// Também inicializar quando o carrinho for atualizado via AJAX
document.addEventListener('cart:update', () => {
  if (!window.cartMinimumValueInstance) {
    window.cartMinimumValueInstance = new CartMinimumValue();
  } else {
    window.cartMinimumValueInstance.validateCart();
  }
});

// Inicializa imediatamente para casos onde o DOM já está carregado
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  if (!window.cartMinimumValueInstance) {
    window.cartMinimumValueInstance = new CartMinimumValue();
  }
}