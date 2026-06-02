interface VisuallyHiddenTableProps {
  caption: string
  columns: string[]
  rows: Array<Array<string | number>>
}

/** Screen-reader table alternative for a chart (a11y: data-table rule). */
export function VisuallyHiddenTable({ caption, columns, rows }: VisuallyHiddenTableProps) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map(c => (
            <th key={c} scope="col">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((cell, j) => (
              <td key={j}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
