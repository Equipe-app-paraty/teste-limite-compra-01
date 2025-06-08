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
    
    // Impedir edição direta dos inputs de quantidade
    this.makeQuantityInputsReadOnly();
  }

  cartUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      if (event.source === 'cart-items') {
        return;
      }
      const result = this.onCartUpdate();
      // Reaplica a restrição de edição após atualização do carrinho
      setTimeout(() => this.makeQuantityInputsReadOnly(), 100);
      return result;
    });
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }
  
  /**
   * Torna os inputs de quantidade somente leitura, mas mantém os botões funcionais
   */
  makeQuantityInputsReadOnly() {
    // Seleciona todos os inputs de quantidade no carrinho
    const quantityInputs = this.querySelectorAll('input[name="updates[]"], input[name^="quantity"]');
    
    quantityInputs.forEach(input => {
      // Torna o input somente leitura
      input.readOnly = true;
      
      // Adiciona estilo para indicar que é somente leitura
      input.style.backgroundColor = '#f8f8f8';
      input.style.cursor = 'not-allowed';
      
      // Impede a edição direta via teclado
      input.addEventListener('keydown', function(event) {
        // Permite teclas de navegação (tab, setas) mas bloqueia entrada de texto
        if (event.key.length === 1 || event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault();
        }
      });
    });
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
    } else {
      // Verificação adicional para valor mínimo do carrinho
      // Obtém o valor atual do item e o valor total do carrinho
      const currentItemPrice = this.getItemPrice(event.target);
      const currentItemQuantity = this.getItemCurrentQuantity(event.target);
      const cartTotal = this.getCartTotal();
      
      // Calcula a diferença de preço com a nova quantidade
      const priceDifference = currentItemPrice * (inputValue - currentItemQuantity);
      const newCartTotal = cartTotal + priceDifference;
      
      // Verifica se o novo total ficaria abaixo do mínimo (R$90,00 = 9000 centavos)
      if (newCartTotal < 9000 && newCartTotal > 0) {
        message = 'O valor mínimo para compra é de R$90,00';
      }
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
          
          // Reaplica a restrição de edição após atualização do DOM
          setTimeout(() => this.makeQuantityInputsReadOnly(), 100);

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
  
  /**
   * Obtém o preço unitário do item a partir do input de quantidade
   * @param {HTMLElement} quantityInput - O input de quantidade
   * @return {number} - O preço unitário em centavos
   */
  getItemPrice(quantityInput) {
    // Tenta obter o preço do data attribute
    if (quantityInput.dataset.unitPrice) {
      return parseInt(quantityInput.dataset.unitPrice, 10);
    }
    
    // Tenta obter o preço do elemento pai (linha do item)
    const cartItem = quantityInput.closest('.cart-item');
    if (cartItem) {
      // Procura pelo preço unitário no data attribute
      if (cartItem.dataset.unitPrice) {
        return parseInt(cartItem.dataset.unitPrice, 10);
      }
      
      // Procura pelo preço no DOM
      const priceElement = cartItem.querySelector('.price');
      if (priceElement) {
        // Extrai apenas os números do texto do preço
        const priceText = priceElement.textContent;
        const numericValue = priceText.replace(/[^0-9]/g, '');
        return parseInt(numericValue, 10);
      }
    }
    
    // Fallback: tenta obter o preço do objeto Shopify.cart
    if (window.Shopify && window.Shopify.cart) {
      const lineItemId = quantityInput.dataset.index;
      const lineItems = window.Shopify.cart.items;
      if (lineItems && lineItems[lineItemId - 1]) {
        return lineItems[lineItemId - 1].price;
      }
    }
    
    return 0; // Retorna 0 se não conseguir encontrar o preço
  }
  
  /**
   * Obtém a quantidade atual do item
   * @param {HTMLElement} quantityInput - O input de quantidade
   * @return {number} - A quantidade atual
   */
  getItemCurrentQuantity(quantityInput) {
    // Obtém o valor atual do input antes da alteração
    return parseInt(quantityInput.getAttribute('value') || '1', 10);
  }
  
  /**
   * Obtém o valor total do carrinho em centavos
   * @return {number} - O valor total do carrinho em centavos
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
}

customElements.define('cart-items', CartItems);

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

// Função para aplicar a restrição de edição em todos os inputs de quantidade no documento
function makeAllQuantityInputsReadOnly() {
  const quantityInputs = document.querySelectorAll('input[name="updates[]"], input[name^="quantity"]');
  
  quantityInputs.forEach(input => {
    // Torna o input somente leitura
    input.readOnly = true;
    
    // Adiciona estilo para indicar que é somente leitura
    input.style.backgroundColor = '#f8f8f8';
    input.style.cursor = 'not-allowed';
    
    // Impede a edição direta via teclado
    input.addEventListener('keydown', function(event) {
      // Permite teclas de navegação (tab, setas) mas bloqueia entrada de texto
      if (event.key.length === 1 || event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
      }
    });
  });
}

// Observador de mutação para detectar novos inputs de quantidade adicionados ao DOM
const setupMutationObserver = () => {
  const observer = new MutationObserver((mutations) => {
    let shouldApply = false;
    
    mutations.forEach(mutation => {
      if (mutation.type === 'childList' && mutation.addedNodes.length) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.querySelector('input[name="updates[]"], input[name^="quantity"]')) {
              shouldApply = true;
              break;
            }
          }
        }
      }
    });
    
    if (shouldApply) {
      makeAllQuantityInputsReadOnly();
    }
  });
  
  // Observa o corpo do documento para detectar mudanças em qualquer parte do DOM
  observer.observe(document.body, { childList: true, subtree: true });
};

// Inicializa quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  makeAllQuantityInputsReadOnly();
  setupMutationObserver();
});

// Também inicializar quando o carrinho for atualizado via AJAX
document.addEventListener('cart:update', () => {
  makeAllQuantityInputsReadOnly();
});

// Inicializa imediatamente para casos onde o DOM já está carregado
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  makeAllQuantityInputsReadOnly();
  setupMutationObserver();
}
