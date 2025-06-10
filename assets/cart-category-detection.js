/**
 * Cart Category Detection - Implementação de detecção precisa de categorias de produtos
 * 
 * Este módulo fornece métodos confiáveis para detectar a categoria de produtos no carrinho,
 * utilizando múltiplas estratégias para garantir precisão na identificação.
 * 
 * Estratégias implementadas:
 * 1. Verificação por product_type
 * 2. Verificação por handle (slug) do produto
 * 3. Verificação por tags do produto
 * 4. Verificação por coleções associadas ao produto
 * 5. Verificação por metafields personalizados
 */

class CartCategoryDetection {
  constructor() {
    // Categorias que estamos monitorando
    this.beerCategory = 'cerveja';
    this.requiredCategories = ['kit churrasco', 'avulsos'];
    
    // Cache de produtos já verificados para evitar requisições repetidas
    this.productCategoryCache = {};
    
    // Expõe a instância globalmente para uso por outros validadores
    window.cartCategoryDetection = this;
    
    // Inicializa o detector
    this.init();
  }
  
  init() {
    // Pré-carrega informações de produtos no carrinho atual
    this.preloadCartProductsInfo();
  }
  
  /**
   * Pré-carrega informações de produtos no carrinho atual
   * para evitar múltiplas requisições durante a validação
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
    if (product.product_type && product.product_type.toLowerCase().includes(this.beerCategory)) {
      return true;
    }
    
    // Estratégia 2: Verificar pelo handle do produto
    if (product.handle && product.handle.toLowerCase().includes(this.beerCategory)) {
      return true;
    }
    
    // Estratégia 3: Verificar pelas tags do produto
    if (product.tags && Array.isArray(product.tags)) {
      for (const tag of product.tags) {
        if (tag.toLowerCase().includes(this.beerCategory)) {
          return true;
        }
      }
    }
    
    // Estratégia 4: Verificar pelas coleções do produto
    try {
      const collections = await this.fetchProductCollections(product.id);
      for (const collection of collections) {
        if (collection.toLowerCase().includes(this.beerCategory)) {
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
      
      if (categoryMetafield && categoryMetafield.value.toLowerCase().includes(this.beerCategory)) {
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
}

// Inicializa a detecção de categoria quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  if (!window.cartCategoryDetection) {
    window.cartCategoryDetection = new CartCategoryDetection();
  }
});

// Também inicializar quando o carrinho for atualizado via AJAX
document.addEventListener('cart:update', () => {
  if (!window.cartCategoryDetection) {
    window.cartCategoryDetection = new CartCategoryDetection();
  } else {
    // Atualiza o cache de produtos quando o carrinho é atualizado
    window.cartCategoryDetection.preloadCartProductsInfo();
  }
});

// Inicializa imediatamente para casos onde o DOM já está carregado
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  if (!window.cartCategoryDetection) {
    window.cartCategoryDetection = new CartCategoryDetection();
  }
}