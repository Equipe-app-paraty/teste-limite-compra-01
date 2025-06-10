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
    
    // Controle de estado para evitar validações concorrentes
    this.validationInProgress = false;
    this.validationLocks = {
      category: false,  // Lock para validação de categoria
      value: false      // Lock para validação de valor mínimo
    };
    
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
   * e configura a comunicação entre os validadores
   */
  findMinimumValueValidator() {
    // Aguarda um pequeno tempo para garantir que CartMinimumValue já foi inicializado
    setTimeout(() => {
      // Verifica se a instância global existe
      if (window.cartMinimumValueInstance) {
        console.log('Instância de CartMinimumValue encontrada, configurando coordenação');
        this.minimumValueValidator = window.cartMinimumValueInstance;
        
        // Verifica se o validador de valor mínimo tem o sistema de locks
        if (!this.minimumValueValidator.validationLocks) {
          console.log('Adicionando sistema de locks ao validador de valor mínimo');
          this.minimumValueValidator.validationLocks = {
            category: false,  // Lock para validação de categoria
            value: false      // Lock para validação de valor mínimo
          };
        }
        
        // Sobrescreve o método validateCart do CartMinimumValue para coordenar as validações
        if (!this.minimumValueValidator._originalValidateCart) {
          console.log('Configurando coordenação de validação com CartMinimumValue');
          
          // Guarda a referência ao método original
          this.minimumValueValidator._originalValidateCart = this.minimumValueValidator.validateCart;
          
          // Sobrescreve o método validateCart
          this.minimumValueValidator.validateCart = async function() {
            // Verifica se a validação de categoria está em andamento
            if (window.cartCategoryValidation && window.cartCategoryValidation.validationInProgress) {
              console.log('Validação de valor mínimo aguardando validação de categoria...');
              
              // Aguarda até que a validação de categoria seja concluída
              let waitAttempts = 0;
              while (window.cartCategoryValidation.validationInProgress && waitAttempts < 10) {
                await new Promise(resolve => setTimeout(resolve, 50));
                waitAttempts++;
              }
              
              // Se ainda estiver em validação após várias tentativas, prossegue mesmo assim
              if (window.cartCategoryValidation.validationInProgress) {
                console.log('Validação de categoria ainda em andamento, prosseguindo mesmo assim');
              }
            }
            
            // Verifica se a validação de categoria falhou
            if (window.cartCategoryValidation && !window.cartCategoryValidation.isValid) {
              console.log('Validação de categoria falhou, priorizando seu erro');
              return false; // Não executa a validação de valor mínimo se a categoria já falhou
            }
            
            // Executa a validação original de valor mínimo
            try {
              return await this._originalValidateCart.call(this);
            } catch (error) {
              console.error('Erro durante validação de valor mínimo:', error);
              return false;
            }
          };
        }
        
        // Configura evento para revalidar quando o estado de validação de categoria mudar
        document.removeEventListener('category-validation-changed', this._categoryValidationChangedHandler);
        
        this._categoryValidationChangedHandler = async (event) => {
          if (event.detail && event.detail.isValid !== undefined) {
            console.log(`Evento de mudança de validação de categoria recebido: ${event.detail.isValid ? 'válido' : 'inválido'}`);
            
            // Se a validação de categoria passou, verifica o valor mínimo
            if (event.detail.isValid && this.minimumValueValidator && !this.minimumValueValidator.validationInProgress) {
              console.log('Categoria válida, revalidando valor mínimo');
              await this.minimumValueValidator.validateCart();
            }
          }
        };
        
        document.addEventListener('category-validation-changed', this._categoryValidationChangedHandler);
        
        console.log('Coordenação entre validadores configurada com sucesso');
      } else {
        console.log('Instância de CartMinimumValue não encontrada, tentando novamente em 200ms');
        // Tenta novamente após um tempo maior
        setTimeout(() => this.findMinimumValueValidator(), 200);
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
        // Evita múltiplas validações simultâneas
        if (this.validationInProgress) return;
        
        this.setupElements();
        this.validateCart().catch(error => {
          console.error(`Erro ao validar carrinho após evento ${eventName}:`, error);
        });
      });
    });
    
    // Monitora quando o drawer do carrinho é aberto
    document.addEventListener('drawerOpen', (event) => {
      // Evita múltiplas validações simultâneas
      if (this.validationInProgress) return;
      
      this.setupElements();
      this.validateCart().catch(error => {
        console.error('Erro ao validar carrinho após abertura do drawer:', error);
      });
    });
    
    // Escuta eventos do validador de valor mínimo
    document.addEventListener('minimum-value-validation-changed', (event) => {
      if (event.detail && event.detail.isValid !== undefined) {
        // Se a validação de valor mínimo mudou, verifica se precisa atualizar a UI
        if (!this.isValid) {
          // Se a categoria já é inválida, garante que sua mensagem tenha prioridade
          this.showError();
        }
      }
    });
    
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
          // Realiza uma validação rápida antes de permitir o checkout
          const isValid = await this.isCartValid();
          if (!isValid) {
            event.preventDefault();
            this.isValid = false;
            this.showError();
          }
        } catch (error) {
          console.error('Erro na validação final antes do checkout:', error);
          // Em caso de erro, permite o checkout para não bloquear o usuário indevidamente
        }
      });
    });
    
    // Adiciona um observador de mutação para o conteúdo do carrinho
    this.setupCartObserver();
  }
  
  /**
   * Busca informações detalhadas de um produto via API
   * @param {string} handle - O handle (slug) do produto
   * @returns {Promise} - Promise com as informações do produto
   */
  fetchProductInfo(handle) {
    // Cache para evitar requisições repetidas
    if (!this.productCache) {
      this.productCache = {};
    }
    
    // Verifica se já temos as informações em cache
    if (this.productCache[handle]) {
      return Promise.resolve(this.productCache[handle]);
    }
    
    // Busca informações do produto via API
    return fetch(`/products/${handle}.js`)
      .then(response => response.json())
      .then(product => {
        // Armazena em cache
        this.productCache[handle] = product;
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
   */
  async hasBeerProducts() {
    if (!window.Shopify || !window.Shopify.cart || !window.Shopify.cart.items) {
      return false;
    }
    
    for (const item of window.Shopify.cart.items) {
      // Busca informações detalhadas do produto se não estiver em cache
      let product = this.productCache?.[item.handle];
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
   */
  async hasRequiredCategoryProducts() {
    if (!window.Shopify || !window.Shopify.cart || !window.Shopify.cart.items) {
      return false;
    }
    
    for (const item of window.Shopify.cart.items) {
      // Busca informações detalhadas do produto se não estiver em cache
      let product = this.productCache?.[item.handle];
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
   * Verifica se o carrinho é válido de acordo com as regras de categoria
   * @returns {Promise<boolean>} - Promise que resolve para true se o carrinho for válido
   */
  async isCartValid() {
    try {
      console.log('Verificando validade do carrinho com base nas regras de categoria...');
      
      // Verifica se há produtos de cerveja no carrinho
      const hasBeer = await this.hasBeerProducts();
      console.log(`Produtos de cerveja encontrados: ${hasBeer}`);
      
      // Se não há cerveja, o carrinho é válido independente das outras categorias
      if (!hasBeer) {
        console.log('Carrinho não contém cerveja, validação de categoria aprovada');
        return true;
      }
      
      // Se há cerveja, verifica se há produtos das categorias obrigatórias
      const hasRequired = await this.hasRequiredCategoryProducts();
      console.log(`Produtos de categoria obrigatória encontrados: ${hasRequired}`);
      
      // Regra: Se tem cerveja, deve ter pelo menos um produto de categoria obrigatória
      const isValid = hasRequired;
      console.log(`Resultado da validação de regra de categoria: ${isValid ? 'válido' : 'inválido'}`);
      
      return isValid;
    } catch (error) {
      console.error('Erro ao verificar validade do carrinho:', error);
      // Em caso de erro, considera o carrinho válido para não bloquear o usuário indevidamente
      return true;
    }
  }
  
  /**
   * Valida o carrinho e atualiza a UI conforme necessário
   * @returns {Promise<boolean>} Retorna o resultado da validação
   */
  async validateCart() {
    try {
      // Verifica se a validação está em andamento para evitar conflitos
      if (this.validationInProgress) {
        console.log('Validação de categoria já em andamento, aguardando...');
        
        // Aguarda até que a validação atual seja concluída (com timeout)
        let waitAttempts = 0;
        while (this.validationInProgress && waitAttempts < 10) {
          await new Promise(resolve => setTimeout(resolve, 50));
          waitAttempts++;
        }
        
        // Se ainda estiver em validação após várias tentativas, retorna o estado atual
        if (this.validationInProgress) {
          console.log('Validação de categoria ainda em andamento após espera, retornando estado atual');
          return this.isValid;
        }
      }
      
      console.log('Iniciando validação de categoria...');
      this.validationInProgress = true;
      this.validationLocks.category = true;
      
      // Notifica o validador de valor mínimo que a validação de categoria está em andamento
      if (this.minimumValueValidator && this.minimumValueValidator.validationLocks) {
        this.minimumValueValidator.validationLocks.category = true;
      }
      
      const previousState = this.isValid;
      let validationResult = false;
      
      // Usa o detector de categorias externo se disponível
      if (window.cartCategoryDetection) {
        console.log('Usando detector de categorias externo');
        try {
          validationResult = await window.cartCategoryDetection.isCartValid();
        } catch (detectionError) {
          console.error('Erro no detector de categorias externo:', detectionError);
          // Fallback para implementação interna
          validationResult = await this.isCartValid();
        }
      } else {
        // Caso contrário, usa a implementação interna
        console.log('Usando detector de categorias interno');
        validationResult = await this.isCartValid();
      }
      
      // Atualiza o estado de validação
      this.isValid = validationResult;
      console.log(`Resultado da validação de categoria: ${this.isValid ? 'válido' : 'inválido'}`);
      
      // Verifica se o validador de valor mínimo está em processo de validação
      const valueValidator = this.minimumValueValidator || window.cartMinimumValueInstance;
      const valueValidating = valueValidator && valueValidator.validationInProgress;
      
      // Se o validador de valor mínimo estiver em processo de validação, aguarda um pouco
      if (valueValidating) {
        console.log('Validador de valor mínimo em processo, aguardando...');
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      if (this.isValid) {
        console.log('Carrinho válido para categorias, liberando checkout');
        this.checkoutLocked = false;
        this.hideError();
        
        // Transfere o controle para o validador de valor mínimo
        if (valueValidator && !valueValidating) {
          console.log('Transferindo controle para validador de valor mínimo');
          // Aguarda um curto período para evitar conflitos
          await new Promise(resolve => setTimeout(resolve, 50));
          try {
            await valueValidator.validateCart();
          } catch (valueError) {
            console.error('Erro ao chamar validador de valor mínimo:', valueError);
          }
        }
      } else {
        console.log('Carrinho inválido para categorias, bloqueando checkout');
        this.checkoutLocked = true;
        this.disableCheckout();
        this.showError();
      }
      
      // Se o estado mudou, dispara um evento personalizado
      if (previousState !== this.isValid) {
        console.log(`Estado de validação de categoria mudou: ${previousState} -> ${this.isValid}`);
        document.dispatchEvent(new CustomEvent('category-validation-changed', {
          detail: { isValid: this.isValid, validator: this }
        }));
      }
      
      return this.isValid;
    } catch (error) {
      console.error('Erro durante a validação de categoria:', error);
      // Em caso de erro, mantém o estado anterior para evitar bloqueios indevidos
      this.isValid = true;
      return true;
    } finally {
      // Libera o lock de validação
      console.log('Validação de categoria concluída');
      this.validationInProgress = false;
      this.validationLocks.category = false;
      
      // Notifica o validador de valor mínimo que a validação de categoria foi concluída
      if (this.minimumValueValidator && this.minimumValueValidator.validationLocks) {
        this.minimumValueValidator.validationLocks.category = false;
      }
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
    // Usa um temporizador para evitar múltiplas validações em sequência
    let debounceTimer;
    let pendingValidation = false;
    
    const cartObserver = new MutationObserver((mutations) => {
      // Verifica se as mutações são relevantes para a validação
      const relevantMutation = mutations.some(mutation => {
        // Mudanças na estrutura do DOM (adição/remoção de elementos)
        if (mutation.type === 'childList') {
          // Verifica se os nós adicionados/removidos são relevantes (itens do carrinho)
          const hasRelevantNodes = [...mutation.addedNodes, ...mutation.removedNodes].some(node => {
            if (node.nodeType !== Node.ELEMENT_NODE) return false;
            
            // Verifica se é um item do carrinho ou contém um item do carrinho
            return node.classList?.contains('cart-item') || 
                   node.querySelector?.('.cart-item') || 
                   node.hasAttribute?.('data-cart-item-key');
          });
          
          return hasRelevantNodes;
        }
        
        // Mudanças em atributos relevantes (quantidade, preço, etc.)
        if (mutation.type === 'attributes') {
          const relevantAttributes = [
            'data-cart-item-quantity', 
            'data-cart-item-price', 
            'data-cart-item-key',
            'data-cart-item-product-id',
            'data-cart-item-variant-id'
          ];
          
          return relevantAttributes.includes(mutation.attributeName);
        }
        
        return false;
      });
      
      if (relevantMutation) {
        console.log('Detectada mudança relevante no carrinho');
        
        // Cancela qualquer validação pendente
        clearTimeout(debounceTimer);
        pendingValidation = true;
        
        // Agenda uma nova validação após um pequeno atraso para agrupar múltiplas mudanças
        debounceTimer = setTimeout(async () => {
          // Evita múltiplas validações simultâneas
          if (this.validationInProgress) {
            console.log('Validação já em andamento, aguardando...');
            
            // Aguarda até que a validação atual seja concluída
            let waitAttempts = 0;
            while (this.validationInProgress && waitAttempts < 10) {
              await new Promise(resolve => setTimeout(resolve, 50));
              waitAttempts++;
            }
            
            // Se ainda estiver em validação após várias tentativas, desiste
            if (this.validationInProgress) {
              console.log('Desistindo de validação após múltiplas tentativas');
              pendingValidation = false;
              return;
            }
          }
          
          pendingValidation = false;
          console.log('Executando validação após mudança no carrinho');
          
          try {
            // Atualiza os elementos antes de validar
            this.setupElements();
            
            // Executa a validação
            await this.validateCart();
          } catch (error) {
            console.error('Erro ao validar carrinho após mutação DOM:', error);
          }
        }, 150); // 150ms de debounce para dar tempo de todas as mudanças ocorrerem
      }
    });
    
    // Função auxiliar para configurar observação em um elemento
    const observeCartElement = (element, id) => {
      if (!element) {
        console.log(`Elemento ${id} não encontrado para observação`);
        return;
      }
      
      console.log(`Configurando observador para ${id}`);
      cartObserver.observe(element, { 
        childList: true, 
        subtree: true,
        attributes: true,
        attributeFilter: [
          'data-cart-item-quantity', 
          'data-cart-item-price', 
          'data-cart-item-key',
          'data-cart-item-product-id',
          'data-cart-item-variant-id'
        ]
      });
    };
    
    // Observar o carrinho principal
    observeCartElement(document.getElementById('main-cart-items'), 'main-cart-items');
    
    // Observar o drawer do carrinho
    observeCartElement(document.getElementById('CartDrawer'), 'CartDrawer');
    
    // Observar o formulário do carrinho
    observeCartElement(document.getElementById('cart'), 'cart');
    
    // Observar a notificação do carrinho
    observeCartElement(document.getElementById('cart-notification'), 'cart-notification');
    
    // Adiciona um evento de window.load para garantir que todos os elementos do carrinho foram carregados
    window.addEventListener('load', () => {
      if (!pendingValidation && !this.validationInProgress) {
        this.setupElements();
        this.validateCart().catch(error => {
          console.error('Erro ao validar carrinho após carregamento da página:', error);
        });
      }
    });
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