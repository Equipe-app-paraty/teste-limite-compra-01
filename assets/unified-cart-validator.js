/**
 * UnifiedCartValidator - Implementação unificada de validação de carrinho
 * 
 * Esta classe combina as validações de categoria e valor mínimo em uma única solução,
 * eliminando problemas de coordenação, race conditions e conflitos entre validadores.
 * 
 * Características principais:
 * 1. Event delegation simples para evitar conflitos com eventos nativos do Dawn
 * 2. Eliminação de múltiplos MutationObservers para melhor performance
 * 3. Remoção do sistema de locks hierárquicos que causava deadlocks
 * 4. Validação unificada de categorias e valor mínimo
 */

class UnifiedCartValidator {
  constructor() {
    // Configurações de validação
    this.minimumValue = 9000; // R$90 em centavos
    this.restrictedCategory = 'cerveja';
    this.requiredCategories = ['kit churrasco', 'avulsos'];
    this.errorMessages = {
      category: 'Produtos da categoria "cerveja" só podem ser comprados com "kit churrasco" OU "avulsos"',
      minimum: 'Valor mínimo de R$90 para finalizar a compra'
    };
    
    // Estado de validação
    this.isValid = {
      category: true,
      minimum: true
    };
    
    // Controle de validação em andamento
    this.validationInProgress = false;
    
    // Cache de produtos já verificados
    this.productCategoryCache = {};
    
    // Expõe a instância globalmente para uso por outros componentes
    window.unifiedCartValidator = this;
    
    // Inicializa o validador
    this.init();
  }
  
  /**
   * Inicializa o validador configurando elementos e event listeners
   */
  init() {
    // Configura elementos do DOM
    this.setupElements();
    
    // Configura event listeners usando event delegation
    this.setupEventListeners();
    
    // Pré-carrega informações de produtos no carrinho atual
    this.preloadCartProductsInfo();
    
    // Valida o carrinho inicialmente
    this.validateCart();
  }
  
  /**
   * Configura referências aos elementos do DOM
   */
  setupElements() {
    // Botões de checkout em diferentes locais do carrinho
    this.checkoutButtons = {
      main: document.querySelectorAll('form[action="/cart"] [name="checkout"]'),
      drawer: document.querySelectorAll('cart-drawer [name="checkout"]'),
      notification: document.querySelectorAll('cart-notification [name="checkout"]')
    };
    
    // Containers para mensagens de erro
    this.errorContainers = {
      main: document.querySelector('#cart-errors') || document.querySelector('.cart__footer'),
      drawer: document.querySelector('#CartDrawer-CartErrors') || document.querySelector('.drawer__footer'),
      notification: document.querySelector('cart-notification .cart-notification-checkout')
    };
  }
  
  /**
   * Configura event listeners usando event delegation
   */
  setupEventListeners() {
    // Event delegation para botões de checkout
    document.addEventListener('click', this.handleCheckout.bind(this));
    
    // Escuta eventos de atualização do carrinho
    document.addEventListener('cart:update', this.validateCart.bind(this));
    
    // Escuta eventos de abertura do drawer do carrinho
    document.addEventListener('cart:toggle', this.setupElements.bind(this));
    
    // Escuta eventos de adição de item ao carrinho
    document.addEventListener('cart:add', this.validateCart.bind(this));
    
    // Escuta eventos de remoção de item do carrinho
    document.addEventListener('cart:remove', this.validateCart.bind(this));
    
    // Escuta eventos de atualização de quantidade
    document.addEventListener('cart:change', this.validateCart.bind(this));
  }
  
  /**
   * Manipula cliques nos botões de checkout
   * @param {Event} event - O evento de clique
   */
  async handleCheckout(event) {
    // Verifica se o elemento clicado é um botão de checkout
    if (event.target.matches('[name="checkout"]')) {
      event.preventDefault();
      
      // Valida o carrinho antes de prosseguir
      const isValid = await this.validateCartComplete();
      
      // Se o carrinho for válido, permite o checkout
      if (isValid) {
        event.target.form.submit();
      }
    }
  }
  
  /**
   * Pré-carrega informações de produtos no carrinho atual
   */
  preloadCartProductsInfo() {
    if (!window.Shopify || !window.Shopify.cart || !window.Shopify.cart.items) {
      return;
    }
    
    // Para cada item no carrinho, busca informações detalhadas
    window.Shopify.cart.items.forEach(item => {
      if (item.handle && !this.productCategoryCache[item.handle]) {
        this.fetchProductInfo(item.handle);
      }
    });
  }
  
  /**
   * Busca informações detalhadas de um produto via API
   * @param {string} handle - O handle (slug) do produto
   * @returns {Promise} - Promise com as informações do produto
   */
  fetchProductInfo(handle) {
    // Verifica se já temos as informações em cache
    if (this.productCategoryCache[handle]) {
      return Promise.resolve(this.productCategoryCache[handle]);
    }
    
    // Busca informações do produto via API
    return fetch(`/products/${handle}.js`)
      .then(response => response.json())
      .then(product => {
        // Armazena em cache
        this.productCategoryCache[handle] = product;
        return product;
      })
      .catch(error => {
        console.error(`Erro ao buscar informações do produto ${handle}:`, error);
        return null;
      });
  }
  
  /**
   * Busca informações sobre as coleções de um produto
   * @param {string} productId - O ID do produto
   * @returns {Promise} - Promise com as coleções do produto
   */
  fetchProductCollections(productId) {
    // Esta função simula a busca de coleções, já que a API JS do Shopify não fornece
    // diretamente as coleções de um produto. Em um ambiente real, isso seria
    // implementado via API GraphQL ou endpoint personalizado.
    
    // Para fins de demonstração, vamos usar uma abordagem baseada em atributos data
    // que podem ser adicionados aos elementos do produto no carrinho
    const productElements = document.querySelectorAll(`[data-product-id="${productId}"]`);
    const collections = [];
    
    productElements.forEach(element => {
      const collectionsData = element.getAttribute('data-product-collections');
      if (collectionsData) {
        try {
          const parsedCollections = JSON.parse(collectionsData);
          collections.push(...parsedCollections);
        } catch (e) {
          console.error('Erro ao parsear coleções:', e);
        }
      }
    });
    
    return Promise.resolve(collections);
  }
  
  /**
   * Verifica se um produto pertence à categoria de cerveja
   * @param {Object} product - O objeto do produto
   * @returns {Promise<boolean>} - Promise que resolve para true se o produto for cerveja
   */
  async isBeerProduct(product) {
    if (!product) return false;
    
    // Estratégia 1: Verificar pelo product_type
    if (product.product_type && product.product_type.toLowerCase().includes(this.restrictedCategory)) {
      return true;
    }
    
    // Estratégia 2: Verificar pelo handle do produto
    if (product.handle && product.handle.toLowerCase().includes(this.restrictedCategory)) {
      return true;
    }
    
    // Estratégia 3: Verificar pelas tags do produto
    if (product.tags && Array.isArray(product.tags)) {
      for (const tag of product.tags) {
        if (tag.toLowerCase().includes(this.restrictedCategory)) {
          return true;
        }
      }
    }
    
    // Estratégia 4: Verificar pelas coleções do produto
    try {
      const collections = await this.fetchProductCollections(product.id);
      for (const collection of collections) {
        if (collection.toLowerCase().includes(this.restrictedCategory)) {
          return true;
        }
      }
    } catch (error) {
      console.error('Erro ao verificar coleções:', error);
    }
    
    // Estratégia 5: Verificar por metafields personalizados
    if (product.metafields) {
      const categoryMetafield = product.metafields.find(m => 
        m.namespace === 'product' && m.key === 'category'
      );
      
      if (categoryMetafield && categoryMetafield.value.toLowerCase().includes(this.restrictedCategory)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Verifica se um produto pertence a uma das categorias obrigatórias
   * @param {Object} product - O objeto do produto
   * @returns {Promise<boolean>} - Promise que resolve para true se o produto for de categoria obrigatória
   */
  async isRequiredCategoryProduct(product) {
    if (!product) return false;
    
    // Estratégia 1: Verificar pelo product_type
    if (product.product_type) {
      for (const category of this.requiredCategories) {
        if (product.product_type.toLowerCase().includes(category)) {
          return true;
        }
      }
    }
    
    // Estratégia 2: Verificar pelo handle do produto
    if (product.handle) {
      for (const category of this.requiredCategories) {
        if (product.handle.toLowerCase().includes(category)) {
          return true;
        }
      }
    }
    
    // Estratégia 3: Verificar pelas tags do produto
    if (product.tags && Array.isArray(product.tags)) {
      for (const tag of product.tags) {
        for (const category of this.requiredCategories) {
          if (tag.toLowerCase().includes(category)) {
            return true;
          }
        }
      }
    }
    
    // Estratégia 4: Verificar pelas coleções do produto
    try {
      const collections = await this.fetchProductCollections(product.id);
      for (const collection of collections) {
        for (const category of this.requiredCategories) {
          if (collection.toLowerCase().includes(category)) {
            return true;
          }
        }
      }
    } catch (error) {
      console.error('Erro ao verificar coleções:', error);
    }
    
    // Estratégia 5: Verificar por metafields personalizados
    if (product.metafields) {
      const categoryMetafield = product.metafields.find(m => 
        m.namespace === 'product' && m.key === 'category'
      );
      
      if (categoryMetafield) {
        for (const category of this.requiredCategories) {
          if (categoryMetafield.value.toLowerCase().includes(category)) {
            return true;
          }
        }
      }
    }
    
    return false;
  }
  
  /**
   * Verifica se o carrinho contém produtos da categoria "cerveja"
   * @returns {Promise<boolean>} - Promise que resolve para true se o carrinho contiver cerveja
   */
  async hasBeerProducts() {
    if (!window.Shopify || !window.Shopify.cart || !window.Shopify.cart.items) {
      return false;
    }
    
    for (const item of window.Shopify.cart.items) {
      // Busca informações detalhadas do produto se não estiver em cache
      let product = this.productCategoryCache[item.handle];
      if (!product) {
        product = await this.fetchProductInfo(item.handle);
      }
      
      if (await this.isBeerProduct(product)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Verifica se o carrinho contém pelo menos um produto das categorias obrigatórias
   * @returns {Promise<boolean>} - Promise que resolve para true se o carrinho contiver produto obrigatório
   */
  async hasRequiredCategoryProducts() {
    if (!window.Shopify || !window.Shopify.cart || !window.Shopify.cart.items) {
      return false;
    }
    
    for (const item of window.Shopify.cart.items) {
      // Busca informações detalhadas do produto se não estiver em cache
      let product = this.productCategoryCache[item.handle];
      if (!product) {
        product = await this.fetchProductInfo(item.handle);
      }
      
      if (await this.isRequiredCategoryProduct(product)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Verifica se as categorias no carrinho são válidas
   * @returns {Promise<{valid: boolean, message: string}>} - Resultado da validação
   */
  async validateCategories() {
    // Verifica se o carrinho contém produtos da categoria "cerveja"
    const hasBeer = await this.hasBeerProducts();
    
    // Se não tiver cerveja, a validação de categoria é sempre válida
    if (!hasBeer) {
      return { valid: true, message: '' };
    }
    
    // Se tiver cerveja, precisa ter pelo menos um produto das categorias obrigatórias
    const hasRequiredCategory = await this.hasRequiredCategoryProducts();
    
    return {
      valid: hasRequiredCategory,
      message: hasRequiredCategory ? '' : this.errorMessages.category
    };
  }
  
  /**
   * Verifica se o valor total do carrinho atinge o mínimo
   * @returns {boolean} - True se o valor for válido
   */
  validateMinimumValue() {
    // Obtém o valor total do carrinho
    const cartTotal = this.getCartTotal();
    
    // Verifica se o valor total é maior ou igual ao mínimo
    return cartTotal >= this.minimumValue;
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
  
  /**
   * Valida o carrinho completo (categorias e valor mínimo)
   * @returns {Promise<boolean>} - Promise que resolve para true se o carrinho for válido
   */
  async validateCartComplete() {
    // Evita validações concorrentes
    if (this.validationInProgress) {
      return new Promise(resolve => {
        // Aguarda 100ms e tenta novamente
        setTimeout(async () => {
          resolve(await this.validateCartComplete());
        }, 100);
      });
    }
    
    this.validationInProgress = true;
    
    try {
      // Valida categorias
      const categoryValidation = await this.validateCategories();
      this.isValid.category = categoryValidation.valid;
      
      // Valida valor mínimo
      this.isValid.minimum = this.validateMinimumValue();
      
      // Atualiza a UI com base nos resultados
      if (!this.isValid.category) {
        this.showError('category', categoryValidation.message);
        this.disableCheckout();
        return false;
      } else if (!this.isValid.minimum) {
        this.showError('minimum', this.errorMessages.minimum);
        this.disableCheckout();
        return false;
      } else {
        this.hideAllErrors();
        this.enableCheckout();
        return true;
      }
    } catch (error) {
      console.error('Erro ao validar carrinho:', error);
      return true; // Em caso de erro, permite o checkout para não bloquear o usuário
    } finally {
      this.validationInProgress = false;
    }
  }
  
  /**
   * Valida o carrinho e atualiza a UI
   */
  async validateCart() {
    // Atualiza elementos do DOM antes da validação
    this.setupElements();
    
    // Valida o carrinho completo
    await this.validateCartComplete();
    
    // Dispara evento personalizado com o resultado da validação
    document.dispatchEvent(new CustomEvent('cart-validation-changed', {
      detail: {
        isValid: this.isValid.category && this.isValid.minimum
      }
    }));
  }
  
  /**
   * Desabilita os botões de checkout
   */
  disableCheckout() {
    // Desabilita todos os botões de checkout
    Object.values(this.checkoutButtons).forEach(buttons => {
      buttons.forEach(button => {
        button.setAttribute('disabled', 'disabled');
        button.classList.add('button--disabled');
      });
    });
  }
  
  /**
   * Habilita os botões de checkout
   */
  enableCheckout() {
    // Habilita todos os botões de checkout
    Object.values(this.checkoutButtons).forEach(buttons => {
      buttons.forEach(button => {
        button.removeAttribute('disabled');
        button.classList.remove('button--disabled');
      });
    });
  }
  
  /**
   * Exibe mensagem de erro
   * @param {string} type - O tipo de erro ('category' ou 'minimum')
   * @param {string} message - A mensagem de erro
   */
  showError(type, message) {
    // Remove erros existentes do mesmo tipo
    this.hideError(type);
    
    // Cria elemento de erro
    const errorElement = document.createElement('div');
    errorElement.classList.add('cart-error', `cart-error--${type}`);
    errorElement.setAttribute('role', 'alert');
    errorElement.innerHTML = `
      <svg class="icon icon-error" aria-hidden="true" focusable="false">
        <use href="#icon-error"></use>
      </svg>
      <div class="cart-error__text">${message}</div>
    `;
    
    // Adiciona o erro aos containers
    Object.values(this.errorContainers).forEach(container => {
      if (container) {
        const errorClone = errorElement.cloneNode(true);
        container.prepend(errorClone);
      }
    });
  }
  
  /**
   * Remove mensagem de erro específica
   * @param {string} type - O tipo de erro ('category' ou 'minimum')
   */
  hideError(type) {
    // Remove todos os erros do tipo especificado
    document.querySelectorAll(`.cart-error--${type}`).forEach(error => {
      error.remove();
    });
  }
  
  /**
   * Remove todas as mensagens de erro
   */
  hideAllErrors() {
    // Remove todos os erros
    document.querySelectorAll('.cart-error').forEach(error => {
      error.remove();
    });
  }
}

// Inicializa o validador unificado quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  if (!window.unifiedCartValidator) {
    window.unifiedCartValidator = new UnifiedCartValidator();
  }
});

// Também inicializar quando o carrinho for atualizado via AJAX
document.addEventListener('cart:update', () => {
  if (!window.unifiedCartValidator) {
    window.unifiedCartValidator = new UnifiedCartValidator();
  } else {
    // Atualiza o cache de produtos quando o carrinho é atualizado
    window.unifiedCartValidator.preloadCartProductsInfo();
    window.unifiedCartValidator.validateCart();
  }
});

// Inicializa imediatamente para casos onde o DOM já está carregado
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  if (!window.unifiedCartValidator) {
    window.unifiedCartValidator = new UnifiedCartValidator();
  }
}