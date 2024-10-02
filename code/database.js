const mysql = require('mysql2/promise');

let connection

async function useConnection() {
    if (!connection) {
        connection = await mysql.createConnection({
            host: 'mysql',
            user: 'root',
            database: 'todo_app',
            password: 'mysql'
        })

        console.log('Database connected')
    }

    return connection
}


module.exports = useConnection

