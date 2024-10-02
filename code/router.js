const router = require('koa-router')()
const {
    listTodos,
    createTodo,
    clearTodos,
    getTodo,
    clearTodo,
    createTag,
    getTagsTodo,
    setTagTodo,
    listTags,
    clearTags,
    getTag,
    clearTag,
    getTodosTag,
    clearTagsTodo,
    clearTagTodo,
    updateTodo,
    updateTag,
} = require('./logic')

router.get('/todos/', listTodos)
router.post('/todos/', createTodo)
router.delete('/todos/', clearTodos)
router.get('todo', '/todos/:id', getTodo)
router.delete('/todos/:id', clearTodo);
router.patch('/todos/:id', updateTodo)
router.get('/todos/:id/tags/', getTagsTodo)
router.post('/todos/:id/tags/', setTagTodo)
router.delete('/todos/:id/tags/', clearTagsTodo)
router.delete('/todos/:id/tags/:tag_id', clearTagTodo)
router.get('/tags/', listTags)
router.post('/tags/', createTag)
router.delete('/tags/', clearTags)
router.get('/tags/:id', getTag)
router.delete('/tags/:id', clearTag)
router.patch('/tags/:id', updateTag)
router.get('/tags/:id/todos/', getTodosTag)

module.exports = router
