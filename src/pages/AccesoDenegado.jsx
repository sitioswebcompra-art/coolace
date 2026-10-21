import { Link } from 'react-router-dom';
export default function AccesoDenegado() {
  return (<div className="flex flex-col items-center justify-center py-20 text-center"><h2 className="text-3xl font-bold text-red-500 mb-4">Acceso Restringido</h2><Link to="/" className="btn-primary">Volver al Inicio</Link></div>);
}