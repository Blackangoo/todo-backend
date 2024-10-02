const useConnection = require('./database')

async function listTodos(ctx) {
    try {
        const connection = await useConnection();
        
        const sql = `
            SELECT 
                t.todo_id AS id,
                t.title,
                t.completed,
                t.order,
                tg.tag_id AS tag_id,
                tg.title AS tag_title
            FROM todos t
            LEFT JOIN todo_tags tt ON t.todo_id = tt.todo_id
            LEFT JOIN tags tg ON tt.tag_id = tg.tag_id;
        `;
        
        const [results] = await connection.query(sql);

        const todos = [];
        const todoMap = {};
        // Iterate over each row returned by the query
        results.forEach(row => {
            const todo = todoMap[row.id] ||= {
                id: row.id.toString(),
                title: row.title,
                completed: row.completed === 1,
                url: `http://${ctx.host}/todos/${row.id}`,
                order: row.order,
                tags: []
            };
        
            if (row.tag_id) {
                todo.tags.push({
                    id: row.tag_id.toString(),
                    title: row.tag_title,
                    url: `http://${ctx.host}/tags/${row.tag_id}`
                });
            }
            todos.push(todo);
        });

        ctx.status = 200;
        ctx.body = todos;
    }
    catch (error) {
        ctx.status = 500;
        ctx.body = { message: 'Failed to get the todos', error: error.message };
    }
}

async function createTodo(ctx) {
    try {
        const todo = ctx.request.body;
        const title = todo.title;
        const completed = todo.completed || false;
        const order = todo.order || 0;

        const sql = 'INSERT INTO `todos` (`title`, `completed`, `order`) VALUES (?, ?, ?)';
        const values = [title, completed, order];

        const connection = await useConnection();
        
        const [results] = await connection.execute(sql, values);
        const id = results.insertId.toString();

        const newTodo = {
            id,
            title: title,
            completed: completed,
            url: `http://${ctx.host}/todos/${id}`,
            order: order
        };

        ctx.body = newTodo;
    }
    catch (error) {
        ctx.status = 500;
        ctx.body = { message: 'Failed to create todo', error: error.message };
    }
}

async function clearTodos(ctx) {
    try {
        const sql = `DELETE FROM todos;`;

        const connection = await useConnection();
        
        await connection.query(sql);

        ctx.status = 204;
    }
    catch (error) {
        ctx.status = 500;
        ctx.body = { message: 'Failed to clear todos', error: error.message };
    }
}

async function getTodo(ctx) {
    try {
        const todoId = ctx.params.id;
        const connection = await useConnection();

        const sql = `
            SELECT 
                t.todo_id AS id,
                t.title,
                t.completed,
                t.order,
                tg.tag_id AS tag_id,
                tg.title AS tag_title
            FROM todos t
            LEFT JOIN todo_tags tt ON t.todo_id = tt.todo_id
            LEFT JOIN tags tg ON tt.tag_id = tg.tag_id
            WHERE t.todo_id = ?;
        `;

        const [results] = await connection.execute(sql, [todoId]);

        const todo = {
            id: results[0].id.toString(),
            title: results[0].title,
            completed: (results[0].completed === 1),
            url: `http://${ctx.host}/todos/${results[0].id}`,
            order: results[0].order,
            tags: []
        };

        results.forEach(row => {
            if (row.tag_id) {
                todo.tags.push({
                    id: row.tag_id.toString(),
                    title: row.tag_title,
                    url: `http://${ctx.host}/tags/${row.tag_id}`
                });
            }
        });

        ctx.body = todo;
    }
    catch (error) {
        ctx.status = 500;
        ctx.body = { message: 'Failed to get the todo', error: error.message };
    }
}

async function clearTodo(ctx) {
    try {
        const todoId = ctx.params.id;
        const connection = await useConnection();

        const sql = `DELETE FROM todos WHERE todo_id = ?;`;

        await connection.execute(sql, [todoId]);

        ctx.status = 204;
    }
    catch (error) {
        ctx.status = 500;
        ctx.body = { message: 'Failed to clear the todo', error: error.message };
    }
}

async function updateTodo(ctx) {
    try {
        const todoId = ctx.params.id;
        const { title, completed, order } = ctx.request.body;

        const connection = await useConnection();

        const checkTodoSql = 'SELECT * FROM todos WHERE todo_id = ?;';
        const [todoResults] = await connection.execute(checkTodoSql, [todoId]);

        const currentTodo = todoResults[0];

        const updatedTitle = title !== undefined ? title : currentTodo.title;
        const updatedCompleted = completed !== undefined ? completed : currentTodo.completed;
        const updatedOrder = order !== undefined ? order : currentTodo.order;

        const updateTodoSql = `
            UPDATE todos 
            SET title = ?, completed = ?, \`order\` = ? 
            WHERE todo_id = ?;
        `;
        await connection.execute(updateTodoSql, [updatedTitle, updatedCompleted, updatedOrder, todoId]);

        const updatedTodo = {
            id: todoId.toString(),
            title: updatedTitle,
            completed: !!updatedCompleted,
            url: `http://${ctx.host}/todos/${todoId}`,
            order: updatedOrder
        };

        ctx.status = 200;
        ctx.body = updatedTodo;
    }
    catch (error) {
        ctx.status = 500;
        ctx.body = { message: 'Failed to update todo', error: error.message };
    }
}

async function getTagsTodo(ctx) {
    try {
        const todoId = ctx.params.id;
        const connection = await useConnection();
        
        const sql = `
            SELECT 
                tg.tag_id AS id,
                tg.title AS tag_title
            FROM todo_tags tt
            LEFT JOIN tags tg ON tt.tag_id = tg.tag_id
            WHERE tt.todo_id = ?;
        `;
        
        const [results] = await connection.execute(sql, [todoId]);

        const tags = results.map(row => ({
            id: row.id.toString(),
            title: row.tag_title,
            url: `http://${ctx.host}/tags/${row.id}`
        }));

        ctx.status = 200;
        ctx.body = tags;
    }
    catch (error) {
        ctx.status = 500;
        ctx.body = { message: 'Failed to get the todo\'s tags', error: error.message };
    }
}

async function setTagTodo(ctx) {
    try {
        const todoId = ctx.params.id;
        const tag = ctx.request.body;
        const tagId = tag.id;

        const connection = await useConnection();

        const associateSql = `INSERT INTO todo_tags (todo_id, tag_id) VALUES (?, ?);`;
        await connection.execute(associateSql, [todoId, tagId]);

        ctx.body = {
            ...tag,
            url: `http://${ctx.host}/tags/${tagId}`
        }
        ctx.status=200;
    }
    catch (error) {
        ctx.status = 500;
        ctx.body = { message: 'Failed to set the todo\'s tags', error: error.message };
    }
}

async function clearTagsTodo(ctx) {
    try {
        const todoId = ctx.params.id;
        const connection = await useConnection();

        const deleteTagsSql = `DELETE FROM todo_tags WHERE todo_id = ?;`;
        await connection.execute(deleteTagsSql, [todoId]);

        ctx.status = 204;
    }
    catch (error) {
        ctx.status = 500;
        ctx.body = { message: 'Failed to clear the todo\'s tags', error: error.message };
    }
}

async function clearTagTodo(ctx) {
    try{
    const todoId = ctx.params.id;
    const tagId = ctx.params.tag_id;
    const connection = await useConnection();

    const checkAssociationSql = `SELECT * FROM todo_tags WHERE todo_id = ? AND tag_id = ?;`;
    const [associationResults] = await connection.execute(checkAssociationSql, [todoId, tagId]);

    const deleteTagSql = `DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?;`;
    await connection.execute(deleteTagSql, [todoId, tagId]);

    ctx.body = associationResults[0];
    }
    catch (error) {
        ctx.status = 500;
        ctx.body = { message: 'Failed to clear the todo\'s tag', error: error.message };
    }
}

async function createTag(ctx) {
    try{
        const tag = ctx.request.body;
        const title = tag.title;

        const sql = 'INSERT INTO `tags` (`title`) VALUES (?)';
        const values = [title];

        const connection = await useConnection();
        
        const [results] = await connection.execute(sql, values);
        const id = results.insertId.toString();

        const newTag = {
            id,
            title: title,
            url: `http://${ctx.host}/tags/${id}`
        };

        ctx.body = newTag;
    }
    catch(error) {
        ctx.status = 500;
        ctx.body = { message: 'Failed to set the tag', error: error.message };
    }
}

async function listTags(ctx) {
    try{
        const connection = await useConnection();
        
        const sql = `
            SELECT 
                tg.tag_id AS tag_id,
                tg.title AS tag_title,
                t.todo_id AS todo_id,
                t.title AS todo_title,
                t.completed,
                t.order
            FROM tags tg
            LEFT JOIN todo_tags tt ON tg.tag_id = tt.tag_id
            LEFT JOIN todos t ON tt.todo_id = t.todo_id;
        `;
        
        const [results] = await connection.query(sql);

        const tags = [];
        const tagMap = {};

        results.forEach(row => {
            if (!tagMap[row.tag_id]) {
                tagMap[row.tag_id] = {
                    id: row.tag_id.toString(),
                    title: row.tag_title,
                    url: `http://${ctx.host}/tags/${row.tag_id}`,
                    todos: []
                };
                tags.push(tagMap[row.tag_id]);
            }

            if (row.todo_id) {
                tagMap[row.tag_id].todos.push({
                    id: row.todo_id.toString(),
                    title: row.todo_title,
                    completed: (row.completed === 1),
                    url: `http://${ctx.host}/todos/${row.todo_id}`,
                    order: row.order
                });
            }
        });

        ctx.status = 200;
        ctx.body = tags;
    }
    catch(error) {
        ctx.status = 500;
        ctx.body = { message: 'Failed to get the tags', error: error.message };
    }
}

async function clearTags(ctx) {
    try {
        const sql = `DELETE FROM tags;`;

        const connection = await useConnection();
        
        await connection.query(sql);

        ctx.status = 204;
    }
    catch(error) {
        ctx.status = 500;
        ctx.body = { message: 'Failed to clear the tags', error: error.message };
    }
}

async function getTag(ctx) {
    try {
        const tagId = ctx.params.id;
        const connection = await useConnection();
        
        const sql = `
            SELECT 
                tg.tag_id AS tag_id,
                tg.title AS tag_title,
                t.todo_id AS todo_id,
                t.title AS todo_title,
                t.completed,
                t.order
            FROM tags tg
            LEFT JOIN todo_tags tt ON tg.tag_id = tt.tag_id
            LEFT JOIN todos t ON tt.todo_id = t.todo_id
            WHERE tg.tag_id = ?;
        `;
        
        const [results] = await connection.execute(sql, [tagId]);

        const tag = {
            id: results[0].tag_id.toString(),
            title: results[0].tag_title,
            url: `http://${ctx.host}/tags/${results[0].tag_id}`,
            todos: []
        };

        results.forEach(row => {
            if (row.todo_id) {
                tag.todos.push({
                    id: row.todo_id.toString(),
                    title: row.todo_title,
                    completed: (row.completed === 1),
                    url: `http://${ctx.host}/todos/${row.todo_id}`,
                    order: row.order
                });
            }
        });

        ctx.status = 200;
        ctx.body = tag;
    }
    catch(error) {
        ctx.status = 500;
        ctx.body = { message: 'Failed to get the tag', error: error.message };
    }
}

async function clearTag(ctx) {
    try {
        const tagId = ctx.params.id;
        const connection = await useConnection();

        const getTagSql = `SELECT * FROM tags WHERE tag_id = ?;`;
        const [tagResults] = await connection.execute(getTagSql, [tagId]);

        const deleteSql = `DELETE FROM tags WHERE tag_id = ?;`;
        await connection.execute(deleteSql, [tagId]);

        const deletedTag = {
            id: tagResults[0].tag_id.toString(),
            title: tagResults[0].title,
            url: `http://${ctx.host}/tags/${tagResults[0].tag_id}`
        };

        ctx.status = 200; 
        ctx.body = deletedTag;
    }
    catch(error) {
        ctx.status = 500;
        ctx.body = { message: 'Failed to clear the tag', error: error.message };
    }
}

async function updateTag(ctx) {
    try {
        const tagId = ctx.params.id;
        const { title } = ctx.request.body;

        const connection = await useConnection();

        const checkTagSql = 'SELECT * FROM tags WHERE tag_id = ?;';
        const [tagResults] = await connection.execute(checkTagSql, [tagId]);

        const currentTag = tagResults[0];

        const updatedTitle = title !== undefined ? title : currentTag.title;

        const updateTagSql = `
            UPDATE tags 
            SET title = ?
            WHERE tag_id = ?;
        `;
        await connection.execute(updateTagSql, [updatedTitle, tagId]);

        const updatedTag = {
            id: tagId.toString(),
            title: updatedTitle,
            url: `http://${ctx.host}/tags/${tagId}`,
        };

        ctx.status = 200;
        ctx.body = updatedTag;
    }
    catch(error) {
        ctx.status = 500;
        ctx.body = { message: 'Failed to update the tag', error: error.message };
    }
}

async function getTodosTag(ctx) {
    try {
        const tagId = ctx.params.id;
        const connection = await useConnection();
        
        const sql = `
            SELECT 
                t.todo_id AS id,
                t.title,
                t.completed,
                t.order
            FROM todo_tags tt
            LEFT JOIN todos t ON tt.todo_id = t.todo_id
            WHERE tt.tag_id = ?;
        `;
        
        const [results] = await connection.execute(sql, [tagId]);

        const todos = results.map(row => ({
            id: row.id.toString(),
            title: row.title,
            completed: (row.completed === 1),
            url: `http://${ctx.host}/todos/${row.id}`,
            order: row.order,
        }));

        ctx.body = todos;
    }
    catch(error) {
        ctx.status = 500;
        ctx.body = { message: 'Failed to get the tag\'s todos', error: error.message };
    }
}

module.exports = {
    listTodos,
    createTodo,
    clearTodos,
    getTodo,
    clearTodo,
    updateTodo,
    getTagsTodo,
    setTagTodo,
    clearTagsTodo,
    clearTagTodo,
    listTags,
    createTag,
    clearTags,
    getTag,
    clearTag,
    updateTag,
    getTodosTag,
}
