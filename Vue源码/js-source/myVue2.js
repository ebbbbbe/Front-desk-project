function Vue(options){
    // options.data //获取传进来的参数中的data中对象的值
    // 由于在vue构造函数的原型对象的方法当中，会用到传进来的数据，所以先把数据存储到当前实例对象的某些属性当中

    this.$data = this._data = options.data
    // 数据劫持
    observe(this.$data)

    // 数据代理 就是将将传进来的对象中的数据添加到vm实例对象上
    Object.keys(this.$data).forEach(key=>{
        this.proxy(key)
    })

    // 调用模板编译
    Compile(options.el,this)
   
}

Vue.prototype ={
    proxy:function(key){
        var me = this
        Object.defineProperty(this,key,{
            enumerable:true,
            configurable:true,
            get(){
                return me.$data[key]
            },
            set(newValue){
                me.$data[key] = newValue
            }
        })
    }
}



// 定义数据劫持的方式
function observe(obj){
    // 判断 是不是对象 如果是则继续劫持 也就是继续给对象的属性添加get 会让set
    if(!obj || typeof obj !== 'object') {
        // 阻止代码的向下执行 因为后面要用递归了 要用递归的话 先写上终止条件
        return //终止代码继续向下执行
    } ;
    // 获取到对象中的属性 object.keys
    // Object.keys(obj) // ['msg','num']
    Object.keys(obj).forEach(key=>{
        // 使用object.defineProperty对每个属性做劫持 也就是添加get与set
        var value = obj[key] //先把值存储起来
        observe(value) // 进行递归
        Object.defineProperty(obj,key,{
            enumerable:true, //可修改
            configurable:true, // 可修改
            get(){
                return value
            },
            set(newValue){
                value= newValue
                //  如果是新值 也应该递归一下 ，继续对新的值做劫持
                observe(value)
            }
        })
    })
} 


function Compile(el,vm){
    vm.$el = document.querySelector(el)

    // 创建文档碎片 提高DOM操作的性能
    var fragment = document.createDocumentFragment()

    // 使用循环的方式把所有的子节点都加入到文档碎片中
    var childNode;
    while(childNode = vm.$el.firstChild){
        fragment.appendChild(childNode) 
    }
    // 在文档碎片中进行莫板编译
    replace(fragment)

    // 编译完成 再把文档碎片放入页面中
    vm.$el.appendChild(fragment)

    // 定义一个模板替换的函数
    function replace(node){
        // 创建正则表达式
        var regMustache = /\{\{\s*(\S*)\s*\}\}/

        // 判断节点类型
        if(node.nodeType === 3){ //说明文本
            // 如果是文本节点了， 则需要获取这个文本内容
            const str = node.nodeValue //获取节点内容 也就是文本内容
            // 进行字符串的匹配与提取
            const execStr = regMustache.exec(str) //先匹配提取一下
            if(execStr){
                // 如果regStr 里面有值 比如['{{name}}'，'name'] ['{{num}}','num'] ['{{foo.aa}}','foo.aa']
                // 则需要继续遍历一下
                const value = execStr[1].split('.').reduce((newObj,k)=>newObj[k],vm) //获取vm 上面的数据值
                // 然后进行替换 赋值 下面这行代码其实是一个打开页面时的第一次更新
                node.nodeValue = str.replace(regMustache,value)//将真正的数据替换到插在表达式中 至关重要

                // 当数据更新的时候应该让watcher 自动去更新自己的DOM 节点上上的数据 所以需要new Watcher 创建实例对象
                new Watcher(vm, execStr[1], (newValue) => {
                    node.nodeValue = str.replace(regMustache,newValue)//更新DOM节点上的数据
                })
            }
            return //终止递归的条件
        }

        // 判断当前节点是不是input 输入框
        if(node.nodeType === 1 && node.tagName.toUpperCase() === 'INPUT'){
            // 获取标签上的属性 并装换成真的数组
            // console.log(node); attributes 是获取当前标签上的所有的属性节点
            const  arrAttrs = [].slice.call(node.attributes)
            console.log('arrAttrs',arrAttrs);
            const findAttr = arrAttrs.find(a => a.name === 'v-model')//查找 'v-model' 属性及值
            // console.log(findAttr);
            if(findAttr){
                // 获取到 'v-mode = 'msg' 属性的值 'v-model="info.a"'
                const attrValue = findAttr.value
                const value = attrValue.split('.').reduce((newObj,k)=>newObj[k],vm)
                node.value = value
                // 创建watcher的实例进行更新
                new Watcher(vm,attrValue,(newValue)=>{
                    node.value = newValue
                })

                // 将输入框中的值更新回vm
                node.addEventListener('input',e =>{
                    const keyArr = attrValue.split('.')
                    const obj = keyArr.slice(0,-1).reduce((newObj,k)=>newObj[k],vm)
                    // 将数组更新回vm对象
                    obj[keyArr[jeyArr.length - 1]] = e.target.value
                })
            } 
        }
        // 如果不是文本节点 说明可能会有字节点则继续遍历
        node.childNodes.forEach(child => replace(child))
    }
}

// 发布者
function Dep(){
    this.subs = []
}
Dep.prototype ={
    addSub:function(watcher){
        this.subs.push(watcher)
    },
    notify:function(){
        this.subs.forEach(watcher => watcher.update())
    }
}
// 订阅者
function Watcher(vm, key, cb){
    // cb这个函数中记录如何更新自己的DOM文本内容
    // 还需要有最新的数据 所以需要传入vm 
    // 还应该要知道传入什么样的key
    this.cb = cb
    this.vm = vm 
    this.key = key

    // 只要new Watcher就会创建实例对象 就会执行下面的三行代码
    Dep.target = this //把当前的实例对象存在Dep.target中
    // 下面的这个代码涉及到取值 只要一取值就会触发数据劫持中的get中的逻辑
    key.split('.').reduce((newObj,k)=>newObj[k],vm)//这一行代码的意思其实是为了触发劫持中的get
    Dep.target = null
}

Watcher.prototype = {
    update:function(){
        // 真正更新的时候得到数据
        let value = this.key.split('.').reduce((newObj,k) => newObj[k],vm)
        this.cb(value)//执行cb中的代码 
    }
}