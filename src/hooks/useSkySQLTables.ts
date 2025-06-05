import { useEffect, useState } from 'react';

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

  const detectForeignKeys = async (tableName: string, columns: any[]): Promise<{ name: string; type: string; foreignKey?: string }[]> => {
    return Promise.all(columns.map(async col => {
      const columnInfo: { name: string; type: string; foreignKey?: string } = {
        name: col.column_name,
        type: col.data_type
      };

      // Replace foreign key detection with a call to the skysql query endpoint
      const foreignKeyRes = await fetch('http://localhost:3001/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: `SELECT REFERENCED_TABLE_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
          params: [tableName, col.column_name]
        })
      });
      const foreignKeyData = await foreignKeyRes.json();
      if (foreignKeyData.result && foreignKeyData.result.length > 0) {
        columnInfo.foreignKey = foreignKeyData.result[0].REFERENCED_TABLE_NAME;
      }

      return columnInfo;
    }));
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
      setLoading(true);
      setError(null);
      try {
        // Fetch table names from the backend REST API
        const tablesRes = await fetch('http://localhost:3001/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()"
          })
        });
        const tablesData = await tablesRes.json();
        const tableNames = tablesData.result.map((row: any) => row.table_name);
        setTables(tableNames);

        // Fetch columns for each table
        const schemas: TableSchema[] = [];
        for (const tableName of tableNames) {
          const columnsRes = await fetch('http://localhost:3001/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sql: "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?",
              params: [tableName]
            })
          });
          const columnsData = await columnsRes.json();
          schemas.push({
            name: tableName,
            columns: await detectForeignKeys(tableName, columnsData.result)
          });
        }
        setTableSchemas(schemas);
        setRelationships(findTableRelationships(schemas));
      } catch (err) {
        console.error('Error:', err);
        setError('Failed to fetch tables from SkySQL REST API');
      } finally {
        setLoading(false);
      }
    };

    fetchTables();
  }, []);

  return { tables, tableSchemas, relationships, loading, error };
};