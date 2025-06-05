import { useEffect, useState } from 'react';

const { skysql } = await import('../lib/skysql');

interface TableSchema {
  name: string;
  columns: { name: string; type: string; foreignKey?: string }[];
}

interface TableRelationship {
  table1: string;
  table2: string;
  foreignKey: string;
  referencingTable: string;
  referencedTable: string;
}

export const useSkySQLTables = () => {
  const [tables, setTables] = useState<string[]>([]);
  const [tableSchemas, setTableSchemas] = useState<TableSchema[]>([]);
  const [relationships, setRelationships] = useState<TableRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const detectForeignKeys = (tableName: string, columns: any[]): { name: string; type: string; foreignKey?: string }[] => {
    return columns.map(col => {
      const columnInfo: { name: string; type: string; foreignKey?: string } = {
        name: col.column_name,
        type: col.data_type
      };

      // Check if this column is a foreign key by querying information_schema.key_column_usage
      const fkQuery = `
        SELECT referenced_table_name
        FROM information_schema.key_column_usage
        WHERE table_schema = ?
          AND table_name = ?
          AND column_name = ?
          AND referenced_table_name IS NOT NULL
        LIMIT 1
      `;

      // This function is now async, so we need to handle it accordingly in the caller
      skysql.getConnection()
        .then(async conn => {
          try {
            const result = await conn.query(fkQuery, [skysql.config.database, tableName, col.column_name]);
            if (result.length > 0 && result[0].referenced_table_name) {
              columnInfo.foreignKey = result[0].referenced_table_name;
            }
          } finally {
            await conn.end();
          }
        });

      return columnInfo;
    });
  };

  const findTableRelationships = (schemas: TableSchema[]): TableRelationship[] => {
    const relationships: TableRelationship[] = [];
    
    schemas.forEach(schema => {
      schema.columns.forEach(column => {
        if (column.foreignKey) {
          // Check if the referenced table exists
          const referencedTable = schemas.find(s => 
            s.name.toLowerCase() === column.foreignKey?.toLowerCase()
          );
          
          if (referencedTable) {
            relationships.push({
              table1: schema.name,
              table2: referencedTable.name,
              foreignKey: column.name,
              referencingTable: schema.name,
              referencedTable: referencedTable.name
            });
          }
        }
      });
    });
    
    return relationships;
  };

  useEffect(() => {
    const fetchTables = async () => {
      try {
        let conn;
        try {
          conn = await skysql.getConnection();

          // Get table names
          const tablesResult = await conn.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = ?",
            [skysql.config.database]
          );
          const tableNames = tablesResult.map((row: any) => row.table_name);
          setTables(tableNames);

          // Get columns for each table
          const schemas: TableSchema[] = [];
          for (const tableName of tableNames) {
            const columnsResult = await conn.query(
              "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = ? AND table_name = ?",
              [skysql.config.database, tableName]
            );
            schemas.push({
              name: tableName,
              columns: detectForeignKeys(tableName, columnsResult)
            });
          }

          setTableSchemas(schemas);
          setRelationships(findTableRelationships(schemas));
        } finally {
          if (conn) await conn.end();
        }
      } catch (err) {
        console.error('Error:', err);
        setError('Failed to connect to SkySQL');
      } finally {
        setLoading(false);
      }
    };

    fetchTables();
  }, []);

  return { tables, tableSchemas, relationships, loading, error };
};