// Importa a classe CartMinimumValue para validação de valor mínimo
if (typeof CartMinimumValue === 'undefined') {
  class CartMinimumValue {
    constructor() {
      this.minimumValue = 9000; // R$90,00 em centavos
      this.errorMessage = 'O valor mínimo para compra é de R$90,00';
      this.checkoutButtons = [];
      this.errorContainer = null;
      this.setupElements();
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
    
    isCartValid() {
      const cartTotal = this.getCartTotal();
      return cartTotal >= this.minimumValue;
    }
    
    validateCart() {
      if (this.isCartValid()) {
        this.enableCheckout();
        this.hideError();
      } else {
        this.disableCheckout();
        this.showError();
      }
    }
    
    enableCheckout() {
      this.checkoutButtons.forEach(button => {
        button.disabled = false;
        button.classList.remove('button--disabled');
      });
    }
    
    disableCheckout() {
      this.checkoutButtons.forEach(button => {
        button.disabled = true;
        button.classList.add('button--disabled');
      });
    }
    
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
  }
  
  // Cria uma instância global para ser usada em todo o site
  window.cartMinimumValueInstance = new CartMinimumValue();
}

class CartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('click', (event) => {
      event.preventDefault();
      const cartItems = this.closest('cart-items') || this.closest('cart-drawer-items');
      cartItems.updateQuantity(this.dataset.index, 0, event);
    });
  }
}

customElements.define('cart-remove-button', CartRemoveButton);

class CartItems extends HTMLElement {
  constructor() {
    super();
    this.lineItemStatusElement =
      document.getElementById('shopping-cart-line-item-status') || document.getElementById('CartDrawer-LineItemStatus');

    const debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, ON_CHANGE_DEBOUNCE_TIMER);

    this.addEventListener('change', debouncedOnChange.bind(this));
    
    // Torna os inputs de quantidade somente leitura após o carregamento da página
    this.makeQuantityInputsReadOnly();
  }

  cartUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      if (event.source === 'cart-items') {
        return;
      }
      return this.onCartUpdate();
    });
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }
  
  /**
   * Torna todos os inputs de quantidade somente leitura
   * Isso impede que o usuário digite valores diretamente, permitindo apenas
   * o uso dos botões de incremento/decremento para alterar a quantidade
   */
  makeQuantityInputsReadOnly() {
    // Aguarda o DOM estar completamente carregado
    setTimeout(() => {
      // Seleciona todos os inputs de quantidade no carrinho
      const quantityInputs = this.querySelectorAll('.quantity__input');
      
      // Adiciona o atributo readonly a cada input
      quantityInputs.forEach(input => {
        input.setAttribute('readonly', true);
      });
      
      // Adiciona um observador para garantir que novos inputs também sejam somente leitura
      this.setupQuantityInputObserver();
    }, 100);
  }
  
  /**
   * Configura um observador de mutação para monitorar alterações no DOM
   * e tornar novos inputs de quantidade somente leitura
   */
  setupQuantityInputObserver() {
    // Cria um observador de mutação para monitorar alterações no DOM
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          // Verifica se novos inputs de quantidade foram adicionados
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const newInputs = node.querySelectorAll('.quantity__input');
              newInputs.forEach(input => {
                input.setAttribute('readonly', true);
              });
            }
          });
        }
      });
    });
    
    // Inicia a observação do elemento atual e seus descendentes
    observer.observe(this, { childList: true, subtree: true });
  }

  resetQuantityInput(id) {
    const input = this.querySelector(`#Quantity-${id}`);
    input.value = input.getAttribute('value');
    this.isEnterPressed = false;
  }

  setValidity(event, index, message) {
    event.target.setCustomValidity(message);
    event.target.reportValidity();
    this.resetQuantityInput(index);
    event.target.select();
  }

  validateQuantity(event) {
    const inputValue = parseInt(event.target.value);
    const index = event.target.dataset.index;
    let message = '';

    if (inputValue < event.target.dataset.min) {
      message = window.quickOrderListStrings.min_error.replace('[min]', event.target.dataset.min);
    } else if (inputValue > parseInt(event.target.max)) {
      message = window.quickOrderListStrings.max_error.replace('[max]', event.target.max);
    } else if (inputValue % parseInt(event.target.step) !== 0) {
      message = window.quickOrderListStrings.step_error.replace('[step]', event.target.step);
    }

    if (message) {
      this.setValidity(event, index, message);
    } else {
      event.target.setCustomValidity('');
      event.target.reportValidity();
      this.updateQuantity(
        index,
        inputValue,
        event,
        document.activeElement.getAttribute('name'),
        event.target.dataset.quantityVariantId
      );
    }
  }

  onChange(event) {
    this.validateQuantity(event);
  }

  onCartUpdate() {
    if (this.tagName === 'CART-DRAWER-ITEMS') {
      return fetch(`${routes.cart_url}?section_id=cart-drawer`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const selectors = ['cart-drawer-items', '.cart-drawer__footer'];
          for (const selector of selectors) {
            const targetElement = document.querySelector(selector);
            const sourceElement = html.querySelector(selector);
            if (targetElement && sourceElement) {
              targetElement.replaceWith(sourceElement);
              
              // Após substituir o elemento, torna os inputs somente leitura
              if (selector === 'cart-drawer-items') {
                const drawerItems = document.querySelector('cart-drawer-items');
                if (drawerItems && typeof drawerItems.makeQuantityInputsReadOnly === 'function') {
                  drawerItems.makeQuantityInputsReadOnly();
                }
              }
            }
          }
        })
        .catch((e) => {
          console.error(e);
        });
    } else {
      return fetch(`${routes.cart_url}?section_id=main-cart-items`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const sourceQty = html.querySelector('cart-items');
          this.innerHTML = sourceQty.innerHTML;
          
          // Após atualizar o conteúdo, torna os inputs somente leitura
          this.makeQuantityInputsReadOnly();
        })
        .catch((e) => {
          console.error(e);
        });
    }
  }

  getSectionsToRender() {
    return [
      {
        id: 'main-cart-items',
        section: document.getElementById('main-cart-items').dataset.id,
        selector: '.js-contents',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
      {
        id: 'cart-live-region-text',
        section: 'cart-live-region-text',
        selector: '.shopify-section',
      },
      {
        id: 'main-cart-footer',
        section: document.getElementById('main-cart-footer').dataset.id,
        selector: '.js-contents',
      },
    ];
  }

  /**
   * Verifica se o carrinho atende ao valor mínimo após a atualização de quantidade
   * @param {Object} parsedState - Estado do carrinho após atualização
   * @returns {boolean} - Retorna true se o carrinho é válido, false caso contrário
   */
  checkCartMinimumValue(parsedState) {
    // Obtém a instância de CartMinimumValue ou cria uma nova
    if (!window.cartMinimumValueInstance) {
      window.cartMinimumValueInstance = new CartMinimumValue();
    }
    
    // Atualiza o objeto Shopify.cart com os novos dados
    if (window.Shopify && parsedState) {
      window.Shopify.cart = {
        ...window.Shopify.cart,
        total_price: parsedState.total_price,
        item_count: parsedState.item_count,
        items: parsedState.items
      };
    }
    
    // Verifica se o valor do carrinho é válido
    return window.cartMinimumValueInstance.isCartValid();
  }

  updateQuantity(line, quantity, event, name, variantId) {
    this.enableLoading(line);

    const body = JSON.stringify({
      line,
      quantity,
      sections: this.getSectionsToRender().map((section) => section.section),
      sections_url: window.location.pathname,
    });
    const eventTarget = event.currentTarget instanceof CartRemoveButton ? 'clear' : 'change';

    fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
      .then((response) => {
        return response.text();
      })
      .then((state) => {
        const parsedState = JSON.parse(state);

        CartPerformance.measure(`${eventTarget}:paint-updated-sections"`, () => {
          const quantityElement =
            document.getElementById(`Quantity-${line}`) || document.getElementById(`Drawer-quantity-${line}`);
          const items = document.querySelectorAll('.cart-item');

          if (parsedState.errors) {
            quantityElement.value = quantityElement.getAttribute('value');
            this.updateLiveRegions(line, parsedState.errors);
            return;
          }
          
          // Verifica se o carrinho atende ao valor mínimo após a atualização
          const isCartValid = this.checkCartMinimumValue(parsedState);
          
          // Se o carrinho não atender ao valor mínimo e não for uma remoção de item
          if (!isCartValid && quantity > 0) {
            // Restaura o valor original do input
            quantityElement.value = quantityElement.getAttribute('value');
            
            // Reverte a alteração no carrinho
            this.updateQuantity(line, parseInt(quantityElement.getAttribute('value')), event, name, variantId);
            
            // Exibe mensagem de erro
            const minimumValueInstance = window.cartMinimumValueInstance;
            this.updateLiveRegions(line, minimumValueInstance.errorMessage);
            
            // Exibe mensagem de erro no carrinho
            if (minimumValueInstance) {
              minimumValueInstance.showError();
            }
            
            return;
          }

          this.classList.toggle('is-empty', parsedState.item_count === 0);
          const cartDrawerWrapper = document.querySelector('cart-drawer');
          const cartFooter = document.getElementById('main-cart-footer');

          if (cartFooter) cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);
          if (cartDrawerWrapper) cartDrawerWrapper.classList.toggle('is-empty', parsedState.item_count === 0);

          this.getSectionsToRender().forEach((section) => {
            const elementToReplace =
              document.getElementById(section.id).querySelector(section.selector) || document.getElementById(section.id);
            elementToReplace.innerHTML = this.getSectionInnerHTML(
              parsedState.sections[section.section],
              section.selector
            );
          });
          const updatedValue = parsedState.items[line - 1] ? parsedState.items[line - 1].quantity : undefined;
          let message = '';
          if (items.length === parsedState.items.length && updatedValue !== parseInt(quantityElement.value)) {
            if (typeof updatedValue === 'undefined') {
              message = window.cartStrings.error;
            } else {
              message = window.cartStrings.quantityError.replace('[quantity]', updatedValue);
            }
          }
          this.updateLiveRegions(line, message);

          const lineItem =
            document.getElementById(`CartItem-${line}`) || document.getElementById(`CartDrawer-Item-${line}`);
          if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
            cartDrawerWrapper
              ? trapFocus(cartDrawerWrapper, lineItem.querySelector(`[name="${name}"]`))
              : lineItem.querySelector(`[name="${name}"]`).focus();
          } else if (parsedState.item_count === 0 && cartDrawerWrapper) {
            trapFocus(cartDrawerWrapper.querySelector('.drawer__inner-empty'), cartDrawerWrapper.querySelector('a'));
          } else if (document.querySelector('.cart-item') && cartDrawerWrapper) {
            trapFocus(cartDrawerWrapper, document.querySelector('.cart-item__name'));
          }
        });

        CartPerformance.measureFromEvent(`${eventTarget}:user-action`, event);

        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items', cartData: parsedState, variantId: variantId });
      })
      .catch(() => {
        this.querySelectorAll('.loading__spinner').forEach((overlay) => overlay.classList.add('hidden'));
        const errors = document.getElementById('cart-errors') || document.getElementById('CartDrawer-CartErrors');
        errors.textContent = window.cartStrings.error;
      })
      .finally(() => {
        this.disableLoading(line);
      });
  }

  updateLiveRegions(line, message) {
    const lineItemError =
      document.getElementById(`Line-item-error-${line}`) || document.getElementById(`CartDrawer-LineItemError-${line}`);
    if (lineItemError) lineItemError.querySelector('.cart-item__error-text').textContent = message;

    this.lineItemStatusElement.setAttribute('aria-hidden', true);

    const cartStatus =
      document.getElementById('cart-live-region-text') || document.getElementById('CartDrawer-LiveRegionText');
    cartStatus.setAttribute('aria-hidden', false);

    setTimeout(() => {
      cartStatus.setAttribute('aria-hidden', true);
    }, 1000);
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  enableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.add('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) => overlay.classList.remove('hidden'));

    document.activeElement.blur();
    this.lineItemStatusElement.setAttribute('aria-hidden', false);
  }

  disableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    mainCartItems.classList.remove('cart__items--disabled');

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    cartItemElements.forEach((overlay) => overlay.classList.add('hidden'));
    cartDrawerItemElements.forEach((overlay) => overlay.classList.add('hidden'));
  }
}

customElements.define('cart-items', CartItems);

// Adiciona um script para tornar os inputs de quantidade somente leitura em todo o site
document.addEventListener('DOMContentLoaded', function() {
  // Função para tornar todos os inputs de quantidade somente leitura
  function makeAllQuantityInputsReadOnly() {
    const quantityInputs = document.querySelectorAll('.quantity__input');
    quantityInputs.forEach(input => {
      input.setAttribute('readonly', true);
    });
  }
  
  // Executa imediatamente após o carregamento do DOM
  makeAllQuantityInputsReadOnly();
  
  // Configura um observador para monitorar alterações no DOM
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Verifica se novos inputs de quantidade foram adicionados
        makeAllQuantityInputsReadOnly();
      }
    });
  });
  
  // Inicia a observação do documento inteiro
  observer.observe(document.body, { childList: true, subtree: true });
  
  // Adiciona um ouvinte para o evento de atualização do carrinho
  document.addEventListener('cart:update', makeAllQuantityInputsReadOnly);
});

// Define o componente cart-drawer-items se não existir
if (!customElements.get('cart-drawer-items')) {
  customElements.define('cart-drawer-items', class extends CartItems {});
}

if (!customElements.get('cart-note')) {
  customElements.define(
    'cart-note',
    class CartNote extends HTMLElement {
      constructor() {
        super();

        this.addEventListener(
          'input',
          debounce((event) => {
            const body = JSON.stringify({ note: event.target.value });
            fetch(`${routes.cart_update_url}`, { ...fetchConfig(), ...{ body } })
              .then(() => CartPerformance.measureFromEvent('note-update:user-action', event));
          }, ON_CHANGE_DEBOUNCE_TIMER)
        );
      }
    }
  );
}
