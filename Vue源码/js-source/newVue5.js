// 这一版本的Vue 重新修改对象的值 也可以直接全部劫持
// 添加双向数据绑定
function Vue(options) {
  this.$data = this._data = options.data
  // 数据代理
  Object.keys(this.$data).forEach(key => {
    this.proxy(key)
  })
  // 数据劫持
  observe(this.$data)

  // 调用模板编译 
  Compile(options.el, this)
}
Vue.prototype = {
  proxy: function (key) {
    Object.defineProperty(this, key, {
      enumerable: true,
      configurable: true,
      get: function () {
        return this.$data[key]
      },
      set: function (newValue) {
        this.$data[key] = newValue
      }
    })
  }
}
// 数据劫持
function observe(obj) {
  if (!obj || typeof obj !== 'object') return // 不要继续向下执行了
  const dep = new Dep() // 创建一个dep实例对象 为了和watcher取得关联 在get中
  Object.keys(obj).forEach(key => {
    let value = obj[key]
    observe(value)
    Object.defineProperty(obj, key, {
      enumerable: true,
      configurable: true,
      get() {
        // 下面这行代码是为了将订阅者加入到Dep的subs数组当中
        Dep.target && dep.addSub(Dep.target)
        return value
      },
      set(newValue) {
        value = newValue
        observe(value) // 继续递归 让新添加进来的数据也有getter setter

        // 所有的准备工作都完成了之后，只要一更新数据了就通知所有的订阅都来更新页面
        dep.notify()
      }
    })
  })
}

function Compile(el, vm) {
  vm.$el = document.querySelector(el);

  // 创建文档碎片 提高DOM操作的性能
  var fragment = document.createDocumentFragment()

  // 使用循环的方式把所有的子节点都加入到文档碎片中
  var childNode;
  while (childNode = vm.$el.firstChild) {
    fragment.appendChild(childNode) // 是将每一个节点都追加到文档碎片中
    // 文档碎片中就会有很多的节点，比如 元素节点 文本节点 其实主要是这两个
  }
  // 在文档碎片中进行模板编译
  replace(fragment)

  // 编译完成 再把文档碎片放入页面中
  vm.$el.appendChild(fragment)

  // 定义一个模板替换的函数
  function replace(node) {
    // 创建正则表达式
    var regMustache = /\{\{\s*(\S*)\s*\}\}/

    // 判断节点类型
    if (node.nodeType === 3) { // 说明是文本
      // 如果是文本节点了，则需要获取这个文本内容
      const str = node.nodeValue // 获取节点内容 也就是文本内容
      // 进行字符串的匹配与提取
      const execStr = regMustache.exec(str) // 先匹配提取一下
      if (execStr) {
        // 如果regStr里面有值，比如["{{ name }}","name"] ["{{num}}","num"] ["{{foo.aa}}","foo.aa"]
        // 则需要继续遍历一下
        const value = execStr[1].split('.').reduce((newObj, k) => newObj[k], vm) // 获取vm上面的数据值
        // 然后进行替换 赋值 下面这行代码其实是一打开页面时的第一次更新
        node.nodeValue = str.replace(regMustache, value) // 将真正的数据替换到插值表达式中 至关重要

        // 当数据更新的时候应该让watcher自动去更新自己的DOM节点上的数据 所以需要new Watcher创建实例对象
        new Watcher(vm, execStr[1], (newValue) => {
          node.nodeValue = str.replace(regMustache, newValue) // 更新DOM节点上的数据
        })
      }
      return // 终止递归的条件
    }

    // 判断当前节点是不是input输入框
    if (node.nodeType === 1 && node.tagName.toUpperCase() === 'INPUT') {
      // 获取标签上的属性 并转换成真数组
      // console.log(node);  attributes 是获取当前标签上的所有的属性节点
      const arrAttrs = [].slice.call(node.attributes)
      console.log('arrAttrs', arrAttrs);
      const findAttr = arrAttrs.find(a => a.name === 'v-model') // 查找'v-model'属性及值
      // console.log(findAttr);
      if (findAttr) {
        // 获取到'v-mode="msg"'属性的值 'v-model="info.a"'
        const attrValue = findAttr.value
        const value = attrValue.split('.').reduce((newObj, k) => newObj[k], vm)
        node.value = value
        // 创建watcher的实例进行更新
        new Watcher(vm, attrValue, (newValue) => {
          node.value = newValue
        })

        // 将输入框中的值更新回vm
        node.addEventListener('input', e => {
          const keyArr = attrValue.split('.')
          const obj = keyArr.slice(0, -1).reduce((newObj, k) => newObj[k], vm)
          // 将数据更新回vm对象
          obj[keyArr[keyArr.length - 1]] = e.target.value
        })
      }
    }

    // 如果不是文本节点 说明可能还有子节点则继续遍历 递归
    node.childNodes.forEach(child => replace(child))
  }
}



// 发布者
function Dep() {
  this.subs = []
}
Dep.prototype = {
  addSub: function (watcher) {
    this.subs.push(watcher)
  },
  notify: function () {
    this.subs.forEach(watcher => watcher.update())
  }
}

// 订阅者
function Watcher(vm, key, cb) {
  // cb这个函数中记录中如何更新自己DOM的文本内容 
  // 还需要有最新的数据 所以需要传入vm
  // 还应该要知道传入什么样的key
  this.cb = cb
  this.vm = vm
  this.key = key

  // 只要new Watcher就会创建实例 就会执行下面的这三行代码
  Dep.target = this // 把当前的实例对象存到Dep.target中
  // 下面的这行代码涉及到了取值,只要一取值就会触发数据劫持中的get方法，在get操作中有大动作R
  // 所以下面这行代码并不是真正为了取值，仅仅是为了触发get去执行get中的逻辑
  key.split('.').reduce((newObj, k) => newObj[k], vm) // 这一行代码的意思其实是为了触发劫持中的get
  Dep.target = null
}

Watcher.prototype = {
  update: function () {
    // 真正更新的时候得有数据
    let value = this.key.split('.').reduce((newObj, k) => newObj[k], vm)
    this.cb(value) // 执行cb中的代码
  }
}